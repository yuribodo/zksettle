use anchor_lang::prelude::*;
use light_sdk::{
    account::LightAccount,
    address::v2::derive_address,
    cpi::{
        v2::{CpiAccounts, LightSystemProgramCpi},
        InvokeLightSystemProgram, LightCpiInstruction,
    },
    instruction::PackedAddressTreeInfoExt,
};

use crate::constants::MAX_ROOT_AGE_SLOTS;
use crate::error::ZkSettleError;
use crate::instructions::verify_proof::{verify_bundle, BindingInputs, ProofSettled};
use crate::state::{
    compressed::{CompressedAttestation, CompressedNullifier},
    Issuer, ATTESTATION_SEED, NULLIFIER_SEED,
};

use super::{types::HookPayload, ExecuteHook, SettleHook};

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

pub(crate) fn validate_settlement_guards(
    payload_mint: &Pubkey,
    payload_recipient: &Pubkey,
    payload_amount: u64,
    payload_epoch: u64,
    actual_mint: &Pubkey,
    actual_destination: &Pubkey,
    actual_amount: u64,
    issuer_root_slot: u64,
    current_slot: u64,
    unix_timestamp: i64,
) -> Result<()> {
    require!(actual_amount > 0, ZkSettleError::InvalidTransferAmount);
    require!(*payload_mint == *actual_mint, ZkSettleError::MintMismatch);
    require!(
        *payload_recipient == *actual_destination,
        ZkSettleError::RecipientMismatch
    );
    require!(payload_amount == actual_amount, ZkSettleError::AmountMismatch);
    require!(
        current_slot.saturating_sub(issuer_root_slot) <= MAX_ROOT_AGE_SLOTS,
        ZkSettleError::RootStale
    );
    crate::instructions::verify_proof::validate_epoch(unix_timestamp, payload_epoch)?;
    Ok(())
}

fn run_settlement(sctx: SettlementContext<'_, '_>) -> Result<()> {
    let clock = Clock::get()?;
    validate_settlement_guards(
        &sctx.payload.mint,
        &sctx.payload.recipient,
        sctx.payload.amount,
        sctx.payload.epoch,
        &sctx.mint_key,
        &sctx.destination_key,
        sctx.amount,
        sctx.issuer.root_slot,
        clock.slot,
        clock.unix_timestamp,
    )?;

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
    enforce_token_2022_cpi_origin(&ctx.accounts.source_token, ctx.accounts.owner.key())?;

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
