use anchor_lang::prelude::*;

use crate::constants::MAX_ROOT_AGE_SLOTS;
use crate::error::ZkSettleError;
use crate::instructions::settle_core::{settle_core, SettlementParams};
use crate::instructions::verify_proof::{verify_bundle, BindingInputs};
use crate::state::Issuer;

use super::{types::HookPayload, ExecuteHook, SettleHook};

macro_rules! cu_probe {
    ($label:literal) => {
        #[cfg(feature = "hook-cu-probe")]
        {
            msg!(concat!("cu-probe ", $label));
            anchor_lang::solana_program::log::sol_log_compute_units();
        }
    };
}

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

    let timestamp = u64::try_from(clock.unix_timestamp)
        .map_err(|_| error!(ZkSettleError::NegativeClock))?;

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
            sanctions_root: &sctx.issuer.sanctions_root,
            jurisdiction_root: &sctx.issuer.jurisdiction_root,
            timestamp,
        },
    )?;
    cu_probe!("post-verify_bundle");

    let light_args = sctx.payload.light_args;
    let validity_proof = light_args.to_validity_proof()?;

    settle_core(SettlementParams {
        issuer_key: sctx.issuer_key,
        issuer_bytes: sctx.issuer_key.to_bytes(),
        nullifier_hash: sctx.payload.nullifier_hash,
        merkle_root: sctx.issuer.merkle_root,
        sanctions_root: sctx.issuer.sanctions_root,
        jurisdiction_root: sctx.issuer.jurisdiction_root,
        mint: sctx.mint_key,
        recipient: sctx.destination_key,
        amount: sctx.payload.amount,
        epoch: sctx.payload.epoch,
        timestamp,
        slot: clock.slot,
        payer_key: sctx.payer_key,
        validity_proof,
        address_tree_info: light_args.to_tree_info(),
        output_state_tree_index: light_args.output_state_tree_index,
        payer_info: sctx.payer_info,
        remaining_accounts: sctx.remaining,
    })?;
    cu_probe!("post-light-cpi");

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
