use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::{
    extension::{transfer_hook::TransferHook, BaseStateWithExtensions, StateWithExtensions},
    state::Mint as SplMint,
};
use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

use crate::error::ZkSettleError;

use super::{
    types::{ExtraAccountMetaInput, StagedLightArgs, EXTRA_ACCOUNT_META_LIST_SEED, MAX_HOOK_PROOF_BYTES},
    InitExtraAccountMetaList, SetHookPayload,
};

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

pub(crate) fn validate_mint_has_hook(mint_info: &AccountInfo) -> Result<()> {
    require_keys_eq!(
        *mint_info.owner,
        anchor_spl::token_2022::ID,
        ZkSettleError::MintHookMismatch
    );
    let data = mint_info.data.borrow();
    let mint_state = StateWithExtensions::<SplMint>::unpack(&data)
        .map_err(|_| error!(ZkSettleError::MintHookMismatch))?;
    let hook = mint_state
        .get_extension::<TransferHook>()
        .map_err(|_| error!(ZkSettleError::MintHookMismatch))?;
    let hook_program_id = Option::<Pubkey>::from(hook.program_id);
    require!(
        hook_program_id == Some(crate::ID),
        ZkSettleError::MintHookMismatch
    );
    Ok(())
}

// TODO: companion `update_extra_account_meta_list_handler`. TLV is write-once
// today; evolving metas (e.g., new address-tree pubkey indices) requires a
// re-init path. Tracked post-hackathon.
pub fn init_extra_account_meta_list_handler(
    ctx: Context<InitExtraAccountMetaList>,
    extras: Vec<ExtraAccountMetaInput>,
) -> Result<()> {
    validate_mint_has_hook(&ctx.accounts.mint.to_account_info())?;
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
