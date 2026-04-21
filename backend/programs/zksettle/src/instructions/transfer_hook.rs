use anchor_lang::prelude::*;
use light_sdk::{
    account::LightAccount,
    address::v2::derive_address,
    cpi::{
        v2::{CpiAccounts, LightSystemProgramCpi},
        InvokeLightSystemProgram, LightCpiInstruction,
    },
    instruction::{PackedAddressTreeInfo, PackedAddressTreeInfoExt, ValidityProof},
};
use light_sdk::instruction::CompressedProof;
use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

use crate::constants::MAX_ROOT_AGE_SLOTS;
use crate::error::ZkSettleError;
use crate::instructions::verify_proof::{
    verify_bundle, BindingInputs, ProofSettled, EPOCH_LEN_SECS, MAX_EPOCH_LAG,
};
use crate::state::{
    compressed::{CompressedAttestation, CompressedNullifier},
    Issuer, ATTESTATION_SEED, ISSUER_SEED, NULLIFIER_SEED,
};

/// Emit a CU probe when the `hook-cu-probe` feature is on; no-op otherwise.
/// Used to measure the hook path's CU budget against the ADR-022 250K ceiling.
macro_rules! cu_probe {
    ($label:literal) => {
        #[cfg(feature = "hook-cu-probe")]
        {
            msg!(concat!("cu-probe ", $label));
            anchor_lang::solana_program::log::sol_log_compute_units();
        }
    };
}

pub const HOOK_PAYLOAD_SEED: &[u8] = b"hook-payload";
/// Matches `spl_transfer_hook_interface::EXTRA_ACCOUNT_METAS_SEED`.
pub const EXTRA_ACCOUNT_META_LIST_SEED: &[u8] = b"extra-account-metas";

/// Upper bound on `proof_and_witness` bytes held in the payload PDA.
///
/// Sized against the compliance VK (8 public inputs, 3 commitments). Real
/// payloads are < 2 KB; 16 KB is a coarse safety ceiling that still fits the
/// `init` rent envelope. Lower before mainnet if the circuit shape freezes.
pub const MAX_HOOK_PROOF_BYTES: usize = 16_384;

/// Pre-staged Light CPI arguments stored in the hook payload so the Token-2022
/// Execute entry — which only receives `amount: u64` as instruction data — can
/// still drive a Light CPI. Clients must include `set_hook_payload` and the
/// Token-2022 transfer in a single atomic transaction (same-tx staging),
/// otherwise the tree-root index and validity proof go stale.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace)]
pub struct StagedLightArgs {
    /// Whether a compressed proof is present; mirrors `ValidityProof(Option<_>)`.
    pub proof_present: bool,
    /// Packed Groth16 proof bytes, only meaningful when `proof_present` is true.
    pub proof_bytes: [u8; 128],
    /// Index into remaining_accounts of the address merkle tree.
    pub address_mt_index: u8,
    /// Index into remaining_accounts of the address queue.
    pub address_queue_index: u8,
    /// Address-tree root index (for replayability vs. live root).
    pub address_root_index: u16,
    /// Output state-tree index passed to `LightAccount::new_init`.
    pub output_state_tree_index: u8,
}

impl StagedLightArgs {
    fn to_validity_proof(self) -> Result<ValidityProof> {
        if self.proof_present {
            let proof = CompressedProof::try_from(self.proof_bytes.as_ref())
                .map_err(|_| error!(ZkSettleError::HookPayloadInvalid))?;
            Ok(ValidityProof(Some(proof)))
        } else {
            Ok(ValidityProof(None))
        }
    }

    fn to_tree_info(self) -> PackedAddressTreeInfo {
        PackedAddressTreeInfo {
            address_merkle_tree_pubkey_index: self.address_mt_index,
            address_queue_pubkey_index: self.address_queue_index,
            root_index: self.address_root_index,
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct HookPayload {
    pub issuer: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub epoch: u64,
    pub light_args: StagedLightArgs,
    #[max_len(MAX_HOOK_PROOF_BYTES)]
    pub proof_and_witness: Vec<u8>,
    pub bump: u8,
}

/// Anchor-serializable mirror of `spl_tlv_account_resolution::account::ExtraAccountMeta`.
/// Clients submit an ordered list; the program converts and writes the TLV.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct ExtraAccountMetaInput {
    pub discriminator: u8,
    pub address_config: [u8; 32],
    pub is_signer: bool,
    pub is_writable: bool,
}

impl From<ExtraAccountMetaInput> for ExtraAccountMeta {
    fn from(m: ExtraAccountMetaInput) -> Self {
        Self {
            discriminator: m.discriminator,
            address_config: m.address_config,
            is_signer: m.is_signer.into(),
            is_writable: m.is_writable.into(),
        }
    }
}

#[derive(Accounts)]
#[instruction(
    proof_and_witness: Vec<u8>,
    nullifier_hash: [u8; 32],
    mint: Pubkey,
    epoch: u64,
    recipient: Pubkey,
    amount: u64,
    light_args: StagedLightArgs,
)]
pub struct SetHookPayload<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority @ ZkSettleError::UnauthorizedIssuer,
    )]
    pub issuer: Account<'info, Issuer>,

    // Seeded by `authority.key()` alone, not `nullifier_hash`: Token-2022's
    // Execute entry resolves the payload PDA from TLV `AddressConfig`, which
    // only sees `ExecuteInstruction` data (amount) and account keys —
    // nullifier-seeded PDAs are not addressable from the hook path. Trade-off:
    // one outstanding payload per authority, parallel hook transfers from the
    // same authority serialize on this PDA.
    #[account(
        init,
        payer = authority,
        space = 8 + HookPayload::INIT_SPACE,
        seeds = [HOOK_PAYLOAD_SEED, authority.key().as_ref()],
        bump,
    )]
    pub hook_payload: Account<'info, HookPayload>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(extras: Vec<ExtraAccountMetaInput>)]
pub struct InitExtraAccountMetaList<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: mint address is only used as a seed input.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: allocated + populated by this handler via `system_program::create_account`
    /// and `ExtraAccountMetaList::init`. PDA seed matches the SPL transfer-hook
    /// interface convention so Token-2022 can resolve it.
    #[account(
        mut,
        seeds = [EXTRA_ACCOUNT_META_LIST_SEED, mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// Direct-call settlement: caller is the issuer authority, signs the tx, closes
/// the payload to themselves. Used by off-chain agents and tests; not routed
/// through Token-2022.
#[derive(Accounts)]
pub struct SettleHook<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: bound to `hook_payload.mint`.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: bound to `hook_payload.recipient`.
    pub destination_token: UncheckedAccount<'info>,

    #[account(
        mut,
        close = authority,
        seeds = [HOOK_PAYLOAD_SEED, authority.key().as_ref()],
        bump = hook_payload.bump,
    )]
    pub hook_payload: Account<'info, HookPayload>,

    #[account(
        constraint = issuer.key() == hook_payload.issuer @ ZkSettleError::IssuerMismatch,
    )]
    pub issuer: Account<'info, Issuer>,

    pub system_program: Program<'info, System>,
}

/// Token-2022 `Execute` entry. Account layout fixed by the hook interface:
/// positions 0..=3 are source-token / mint / destination-token / owner; the
/// remaining accounts are resolved from the TLV `extra_account_meta_list`.
///
/// `owner` is `UncheckedAccount` because Token-2022 passes the source-owner (or
/// delegate) as a non-signer read-only meta. Authority is enforced by the
/// `hook_payload` PDA seed `[HOOK_PAYLOAD_SEED, owner.key()]` — only the staging
/// signer that created the payload resolves the same PDA.
#[derive(Accounts)]
pub struct ExecuteHook<'info> {
    /// CHECK: source token account; Token-2022 enforces ownership + writability.
    pub source_token: UncheckedAccount<'info>,
    /// CHECK: mint; bound to `hook_payload.mint`.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: destination token; bound to `hook_payload.recipient`.
    pub destination_token: UncheckedAccount<'info>,
    /// CHECK: source owner or delegate; non-signer per hook interface. Bound to
    /// `hook_payload` via PDA seed.
    pub owner: UncheckedAccount<'info>,

    /// CHECK: TLV ExtraAccountMetaList validation state; Token-2022 checks PDA.
    #[account(
        seeds = [EXTRA_ACCOUNT_META_LIST_SEED, mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [HOOK_PAYLOAD_SEED, owner.key().as_ref()],
        bump = hook_payload.bump,
    )]
    pub hook_payload: Account<'info, HookPayload>,

    #[account(
        constraint = issuer.key() == hook_payload.issuer @ ZkSettleError::IssuerMismatch,
    )]
    pub issuer: Account<'info, Issuer>,
}

/// Pure guard for `set_hook_payload`. Extracted so unit tests can cover the
/// input validation without mocking an Anchor `Context`.
pub(crate) fn validate_set_hook_inputs(
    proof_len: usize,
    nullifier_hash: &[u8; 32],
    amount: u64,
) -> Result<()> {
    require!(*nullifier_hash != [0u8; 32], ZkSettleError::ZeroNullifier);
    require!(amount > 0, ZkSettleError::InvalidTransferAmount);
    require!(
        proof_len > 0 && proof_len <= MAX_HOOK_PROOF_BYTES,
        ZkSettleError::HookPayloadInvalid
    );
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn set_hook_payload_handler(
    ctx: Context<SetHookPayload>,
    proof_and_witness: Vec<u8>,
    nullifier_hash: [u8; 32],
    mint: Pubkey,
    epoch: u64,
    recipient: Pubkey,
    amount: u64,
    light_args: StagedLightArgs,
) -> Result<()> {
    validate_set_hook_inputs(proof_and_witness.len(), &nullifier_hash, amount)?;

    let payload = &mut ctx.accounts.hook_payload;
    payload.issuer = ctx.accounts.issuer.key();
    payload.nullifier_hash = nullifier_hash;
    payload.mint = mint;
    payload.recipient = recipient;
    payload.amount = amount;
    payload.epoch = epoch;
    payload.light_args = light_args;
    payload.proof_and_witness = proof_and_witness;
    payload.bump = ctx.bumps.hook_payload;
    Ok(())
}

// TODO: companion `update_extra_account_meta_list_handler`. TLV is write-once
// today; evolving metas (e.g., new address-tree pubkey indices) requires a
// re-init path. Tracked post-hackathon.
pub fn init_extra_account_meta_list_handler(
    ctx: Context<InitExtraAccountMetaList>,
    extras: Vec<ExtraAccountMetaInput>,
) -> Result<()> {
    let metas: Vec<ExtraAccountMeta> = extras.into_iter().map(Into::into).collect();
    let size = ExtraAccountMetaList::size_of(metas.len())
        .map_err(|_| error!(ZkSettleError::HookPayloadInvalid))?;
    let lamports = Rent::get()?.minimum_balance(size);
    let mint_key = ctx.accounts.mint.key();
    let bump = ctx.bumps.extra_account_meta_list;
    let signer_seeds: &[&[&[u8]]] = &[&[EXTRA_ACCOUNT_META_LIST_SEED, mint_key.as_ref(), &[bump]]];

    anchor_lang::system_program::create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::CreateAccount {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.extra_account_meta_list.to_account_info(),
            },
            signer_seeds,
        ),
        lamports,
        size as u64,
        &crate::ID,
    )?;

    let mut data = ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &metas)
        .map_err(|_| error!(ZkSettleError::HookPayloadInvalid))?;
    Ok(())
}

/// Inputs for the shared verify + Light-CPI path. `payer` is the Light payer
/// (also the rent-refund target for settle-path closes).
struct SettlementContext<'a, 'info> {
    payload: &'a HookPayload,
    issuer: &'a Issuer,
    issuer_key: Pubkey,
    mint_key: Pubkey,
    destination_key: Pubkey,
    amount: u64,
    payer_info: &'a AccountInfo<'info>,
    payer_key: Pubkey,
    remaining: &'a [AccountInfo<'info>],
}

fn run_settlement(sctx: SettlementContext<'_, '_>) -> Result<()> {
    require!(sctx.amount > 0, ZkSettleError::InvalidTransferAmount);
    require!(sctx.payload.mint == sctx.mint_key, ZkSettleError::MintMismatch);
    require!(
        sctx.payload.recipient == sctx.destination_key,
        ZkSettleError::RecipientMismatch
    );
    require!(
        sctx.payload.amount == sctx.amount,
        ZkSettleError::AmountMismatch
    );

    let clock = Clock::get()?;
    require!(
        clock.slot.saturating_sub(sctx.issuer.root_slot) <= MAX_ROOT_AGE_SLOTS,
        ZkSettleError::RootStale
    );
    require!(clock.unix_timestamp >= 0, ZkSettleError::NegativeClock);
    let current_epoch = (clock.unix_timestamp / EPOCH_LEN_SECS) as u64;
    require!(
        sctx.payload.epoch <= current_epoch,
        ZkSettleError::EpochInFuture
    );
    require!(
        current_epoch.saturating_sub(sctx.payload.epoch) <= MAX_EPOCH_LAG,
        ZkSettleError::EpochStale
    );

    cu_probe!("pre-verify_bundle");
    verify_bundle(
        &sctx.payload.proof_and_witness,
        &BindingInputs {
            merkle_root: &sctx.issuer.merkle_root,
            nullifier_hash: &sctx.payload.nullifier_hash,
            mint: &sctx.payload.mint,
            epoch: sctx.payload.epoch,
            recipient: &sctx.payload.recipient,
            amount: sctx.payload.amount,
        },
    )?;
    cu_probe!("post-verify_bundle");

    let nullifier_hash = sctx.payload.nullifier_hash;
    let issuer_bytes = sctx.issuer_key.to_bytes();
    let merkle_root = sctx.issuer.merkle_root;
    let payload_amount = sctx.payload.amount;
    let payload_epoch = sctx.payload.epoch;
    let slot = clock.slot;
    let light_args = sctx.payload.light_args;
    let validity_proof = light_args.to_validity_proof()?;
    let address_tree_info = light_args.to_tree_info();
    let output_state_tree_index = light_args.output_state_tree_index;

    let light_cpi_accounts =
        CpiAccounts::new(sctx.payer_info, sctx.remaining, crate::LIGHT_CPI_SIGNER);

    let address_tree_pubkey = address_tree_info
        .get_tree_pubkey(&light_cpi_accounts)
        .map_err(crate::map_light_err!(
            "get_tree_pubkey failed",
            ZkSettleError::InvalidLightAddress
        ))?;

    let (null_addr, null_seed) = derive_address(
        &[NULLIFIER_SEED, &issuer_bytes, &nullifier_hash],
        &address_tree_pubkey,
        &crate::ID,
    );
    let (att_addr, att_seed) = derive_address(
        &[ATTESTATION_SEED, &issuer_bytes, &nullifier_hash],
        &address_tree_pubkey,
        &crate::ID,
    );

    let null_params =
        address_tree_info.into_new_address_params_assigned_packed(null_seed, Some(0));
    let att_params = address_tree_info.into_new_address_params_assigned_packed(att_seed, Some(1));

    let nullifier_account = LightAccount::<CompressedNullifier>::new_init(
        &crate::ID,
        Some(null_addr),
        output_state_tree_index,
    );

    let mut attestation_account = LightAccount::<CompressedAttestation>::new_init(
        &crate::ID,
        Some(att_addr),
        output_state_tree_index,
    );
    attestation_account.issuer = issuer_bytes;
    attestation_account.nullifier_hash = nullifier_hash;
    attestation_account.merkle_root = merkle_root;
    attestation_account.mint = sctx.mint_key.to_bytes();
    attestation_account.recipient = sctx.destination_key.to_bytes();
    attestation_account.amount = payload_amount;
    attestation_account.epoch = payload_epoch;
    attestation_account.slot = slot;
    attestation_account.payer = sctx.payer_key.to_bytes();

    LightSystemProgramCpi::new_cpi(crate::LIGHT_CPI_SIGNER, validity_proof)
        .with_new_addresses(&[null_params, att_params])
        .with_light_account(nullifier_account)
        .map_err(crate::map_light_err!(
            "with_light_account nullifier",
            ZkSettleError::LightAccountPackFailed
        ))?
        .with_light_account(attestation_account)
        .map_err(crate::map_light_err!(
            "with_light_account attestation",
            ZkSettleError::LightAccountPackFailed
        ))?
        .invoke(light_cpi_accounts)
        .map_err(crate::map_light_err!(
            "Light CPI invoke failed",
            ZkSettleError::LightInvokeFailed
        ))?;
    cu_probe!("post-light-cpi");

    emit!(ProofSettled {
        issuer: sctx.issuer_key,
        nullifier_hash,
        merkle_root,
        mint: sctx.mint_key,
        recipient: sctx.destination_key,
        amount: payload_amount,
        epoch: payload_epoch,
        slot,
        payer: sctx.payer_key,
    });
    Ok(())
}

pub fn settle_hook_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, SettleHook<'info>>,
    amount: u64,
) -> Result<()> {
    let issuer_key = ctx.accounts.issuer.key();
    let payer_key = ctx.accounts.authority.key();
    let mint_key = ctx.accounts.mint.key();
    let destination_key = ctx.accounts.destination_token.key();
    run_settlement(SettlementContext {
        payload: &ctx.accounts.hook_payload,
        issuer: &ctx.accounts.issuer,
        issuer_key,
        mint_key,
        destination_key,
        amount,
        payer_info: ctx.accounts.authority.as_ref(),
        payer_key,
        remaining: ctx.remaining_accounts,
    })
}

/// Reject standalone calls to `transfer_hook`. Token-2022 sets the
/// `TransferHookAccount.transferring` flag on the source token account only
/// while a transfer CPI is in flight; any direct caller sees it cleared.
fn enforce_token_2022_cpi_origin(
    source_token: &UncheckedAccount,
    expected_owner: Pubkey,
) -> Result<()> {
    use anchor_spl::token_2022::spl_token_2022::{
        self,
        extension::{
            transfer_hook::TransferHookAccount, BaseStateWithExtensions, StateWithExtensions,
        },
        state::Account as TokenAccount,
    };

    require_keys_eq!(
        *source_token.owner,
        spl_token_2022::ID,
        ZkSettleError::NotToken2022
    );

    let data = source_token.data.borrow();
    let state = StateWithExtensions::<TokenAccount>::unpack(&data)
        .map_err(|_| error!(ZkSettleError::NotToken2022))?;
    require_keys_eq!(
        state.base.owner,
        expected_owner,
        ZkSettleError::OwnerMismatch
    );

    let hook_state = state
        .get_extension::<TransferHookAccount>()
        .map_err(|_| error!(ZkSettleError::NotInTransfer))?;
    require!(
        bool::from(hook_state.transferring),
        ZkSettleError::NotInTransfer
    );

    Ok(())
}

pub fn execute_hook_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, ExecuteHook<'info>>,
    amount: u64,
) -> Result<()> {
    enforce_token_2022_cpi_origin(
        &ctx.accounts.source_token,
        ctx.accounts.owner.key(),
    )?;

    let issuer_key = ctx.accounts.issuer.key();
    let payer_key = ctx.accounts.owner.key();
    let mint_key = ctx.accounts.mint.key();
    let destination_key = ctx.accounts.destination_token.key();
    run_settlement(SettlementContext {
        payload: &ctx.accounts.hook_payload,
        issuer: &ctx.accounts.issuer,
        issuer_key,
        mint_key,
        destination_key,
        amount,
        payer_info: ctx.accounts.owner.as_ref(),
        payer_key,
        remaining: ctx.remaining_accounts,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::error::ERROR_CODE_OFFSET;

    fn err_code<T: std::fmt::Debug>(r: Result<T>) -> u32 {
        match r {
            Err(anchor_lang::error::Error::AnchorError(e)) => e.error_code_number,
            other => panic!("expected AnchorError, got {other:?}"),
        }
    }

    fn nonzero_nullifier() -> [u8; 32] {
        let mut n = [0u8; 32];
        n[0] = 1;
        n
    }

    #[test]
    fn validate_accepts_well_formed_inputs() {
        assert!(validate_set_hook_inputs(256, &nonzero_nullifier(), 10).is_ok());
    }

    #[test]
    fn validate_rejects_zero_nullifier() {
        assert_eq!(
            err_code(validate_set_hook_inputs(256, &[0u8; 32], 10)),
            ERROR_CODE_OFFSET + ZkSettleError::ZeroNullifier as u32,
        );
    }

    #[test]
    fn validate_rejects_zero_amount() {
        assert_eq!(
            err_code(validate_set_hook_inputs(256, &nonzero_nullifier(), 0)),
            ERROR_CODE_OFFSET + ZkSettleError::InvalidTransferAmount as u32,
        );
    }

    #[test]
    fn validate_rejects_empty_proof() {
        assert_eq!(
            err_code(validate_set_hook_inputs(0, &nonzero_nullifier(), 10)),
            ERROR_CODE_OFFSET + ZkSettleError::HookPayloadInvalid as u32,
        );
    }

    #[test]
    fn validate_rejects_oversized_proof() {
        assert_eq!(
            err_code(validate_set_hook_inputs(
                MAX_HOOK_PROOF_BYTES + 1,
                &nonzero_nullifier(),
                10
            )),
            ERROR_CODE_OFFSET + ZkSettleError::HookPayloadInvalid as u32,
        );
    }

    #[test]
    fn validate_accepts_max_proof_len() {
        assert!(
            validate_set_hook_inputs(MAX_HOOK_PROOF_BYTES, &nonzero_nullifier(), 1).is_ok()
        );
    }

    #[test]
    fn staged_args_roundtrip_tree_info() {
        let args = StagedLightArgs {
            proof_present: false,
            proof_bytes: [0u8; 128],
            address_mt_index: 7,
            address_queue_index: 9,
            address_root_index: 42,
            output_state_tree_index: 3,
        };
        let info = args.to_tree_info();
        assert_eq!(info.address_merkle_tree_pubkey_index, 7);
        assert_eq!(info.address_queue_pubkey_index, 9);
        assert_eq!(info.root_index, 42);
    }

    #[test]
    fn staged_args_roundtrip_validity_proof_absent() {
        let args = StagedLightArgs {
            proof_present: false,
            proof_bytes: [0u8; 128],
            address_mt_index: 0,
            address_queue_index: 0,
            address_root_index: 0,
            output_state_tree_index: 0,
        };
        assert!(args.to_validity_proof().unwrap().0.is_none());
    }

    #[test]
    fn staged_args_roundtrip_validity_proof_present() {
        let mut proof_bytes = [0u8; 128];
        for (i, b) in proof_bytes.iter_mut().enumerate() {
            *b = i as u8;
        }
        let args = StagedLightArgs {
            proof_present: true,
            proof_bytes,
            address_mt_index: 0,
            address_queue_index: 0,
            address_root_index: 0,
            output_state_tree_index: 0,
        };
        let vp = args.to_validity_proof().unwrap();
        let inner = vp.0.expect("proof present");
        assert_eq!(inner.a, proof_bytes[0..32]);
        assert_eq!(inner.b, proof_bytes[32..96]);
        assert_eq!(inner.c, proof_bytes[96..128]);
    }

    #[test]
    fn extra_account_meta_input_converts_to_spl_pubkey_variant() {
        let pk = [7u8; 32];
        let input = ExtraAccountMetaInput {
            discriminator: 0,
            address_config: pk,
            is_signer: false,
            is_writable: true,
        };
        let m: ExtraAccountMeta = input.into();
        assert_eq!(m.discriminator, 0);
        assert_eq!(m.address_config, pk);
        assert!(!bool::from(m.is_signer));
        assert!(bool::from(m.is_writable));
    }

    #[test]
    fn hook_payload_init_space_fits_max_proof() {
        // Sanity: InitSpace accounts for the MAX_HOOK_PROOF_BYTES ceiling plus
        // all fixed fields. If a field is added without updating InitSpace via
        // #[max_len], the derive would under-report and `init` would fail at
        // runtime with AccountDidNotSerialize.
        let fixed = 32 + 32 + 32 + 32 + 8 + 8
            + StagedLightArgs::INIT_SPACE
            + 4 /* Vec prefix */ + MAX_HOOK_PROOF_BYTES + 1;
        assert_eq!(HookPayload::INIT_SPACE, fixed);
    }
}
