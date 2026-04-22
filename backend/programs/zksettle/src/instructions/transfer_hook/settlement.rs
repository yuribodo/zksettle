use anchor_lang::prelude::*;

use crate::constants::MAX_ROOT_AGE_SLOTS;
use crate::error::ZkSettleError;
use crate::instructions::bubblegum_mint::{
    cpi_mint_compliance_attestation, cpi_mint_from_remaining_tail, split_light_and_bubblegum,
};
use crate::instructions::settle_core::{settle_core, SettlementParams};
use crate::instructions::verify_proof::{verify_bundle, BindingInputs};
use crate::state::{BubblegumTreeRegistry, Issuer};

use super::{types::HookPayload, ExecuteHook, SettleHook};

enum BubblegumMintMode<'a, 'info> {
    None,
    Tail(&'a [AccountInfo<'info>]),
    Named {
        tree_config: &'a AccountInfo<'info>,
        merkle_tree: &'a AccountInfo<'info>,
        tree_creator: &'a AccountInfo<'info>,
        log_wrapper: &'a AccountInfo<'info>,
        compression: &'a AccountInfo<'info>,
        system_program: &'a AccountInfo<'info>,
        leaf_owner: &'a AccountInfo<'info>,
    },
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
    light_remaining: &'a [AccountInfo<'info>],
    registry: &'a Account<'info, BubblegumTreeRegistry>,
    bubblegum_program: &'a AccountInfo<'info>,
    bubblegum_mint: BubblegumMintMode<'a, 'info>,
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

    crate::cu_probe!("pre-verify_bundle");
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
    crate::cu_probe!("post-verify_bundle");

    let nullifier_hash = sctx.payload.nullifier_hash;
    let merkle_root = sctx.issuer.merkle_root;
    let slot = clock.slot;
    let light_args = sctx.payload.light_args;
    let validity_proof = light_args.to_validity_proof()?;

    settle_core(SettlementParams {
        issuer_key: sctx.issuer_key,
        issuer_bytes: sctx.issuer_key.to_bytes(),
        nullifier_hash,
        merkle_root,
        sanctions_root: sctx.issuer.sanctions_root,
        jurisdiction_root: sctx.issuer.jurisdiction_root,
        mint: sctx.mint_key,
        recipient: sctx.destination_key,
        amount: sctx.payload.amount,
        epoch: sctx.payload.epoch,
        timestamp,
        slot,
        payer_key: sctx.payer_key,
        validity_proof,
        address_tree_info: light_args.to_tree_info(),
        output_state_tree_index: light_args.output_state_tree_index,
        payer_info: sctx.payer_info,
        remaining_accounts: sctx.light_remaining,
    })?;
    crate::cu_probe!("post-light-cpi");

    match &sctx.bubblegum_mint {
        BubblegumMintMode::None => {}
        BubblegumMintMode::Tail(bg) => {
            if !bg.is_empty() {
                crate::cu_probe!("pre-bubblegum-mint");
                cpi_mint_from_remaining_tail(
                    sctx.bubblegum_program,
                    bg,
                    sctx.registry.tree_creator_bump,
                    sctx.issuer_key,
                    nullifier_hash,
                    merkle_root,
                    slot,
                )?;
                crate::cu_probe!("post-bubblegum-mint");
            }
        }
        BubblegumMintMode::Named {
            tree_config,
            merkle_tree,
            tree_creator,
            log_wrapper,
            compression,
            system_program,
            leaf_owner,
        } => {
            crate::cu_probe!("pre-bubblegum-mint");
            cpi_mint_compliance_attestation(
                sctx.bubblegum_program,
                tree_config,
                merkle_tree,
                tree_creator,
                sctx.registry.tree_creator_bump,
                compression,
                log_wrapper,
                system_program,
                sctx.payer_info,
                leaf_owner,
                sctx.issuer_key,
                nullifier_hash,
                merkle_root,
                slot,
            )?;
            crate::cu_probe!("post-bubblegum-mint");
        }
    }

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
        light_remaining: ctx.remaining_accounts,
        registry: &ctx.accounts.registry,
        bubblegum_program: ctx.accounts.bubblegum_program.as_ref(),
        bubblegum_mint: BubblegumMintMode::Named {
            tree_config: ctx.accounts.tree_config.as_ref(),
            merkle_tree: ctx.accounts.merkle_tree.as_ref(),
            tree_creator: ctx.accounts.tree_creator.as_ref(),
            log_wrapper: ctx.accounts.log_wrapper.as_ref(),
            compression: ctx.accounts.compression_program.as_ref(),
            system_program: ctx.accounts.system_program.as_ref(),
            leaf_owner: ctx.accounts.leaf_owner.as_ref(),
        },
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

// TODO: close hook_payload PDA after settlement to reclaim rent and unblock
// the authority for the next transfer (init constraint prevents re-staging
// while the PDA exists). settle_hook path closes it; this path does not.
pub fn execute_hook_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, ExecuteHook<'info>>,
    amount: u64,
) -> Result<()> {
    enforce_token_2022_cpi_origin(&ctx.accounts.source_token, ctx.accounts.owner.key())?;

    let tail = ctx.accounts.hook_payload.light_args.bubblegum_tail;
    let (light_rem, bg) = split_light_and_bubblegum(ctx.remaining_accounts, tail)?;

    let bubblegum_mint = if bg.is_empty() {
        BubblegumMintMode::None
    } else {
        BubblegumMintMode::Tail(bg)
    };

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
        light_remaining: light_rem,
        registry: &ctx.accounts.registry,
        bubblegum_program: ctx.accounts.bubblegum_program.as_ref(),
        bubblegum_mint,
    })
}
