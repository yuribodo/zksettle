use anchor_lang::prelude::*;
use light_sdk::instruction::{PackedAddressTreeInfo, ValidityProof};

use crate::error::ZkSettleError;
use crate::instructions::bubblegum_mint::cpi_mint_compliance_attestation;
use crate::instructions::settle_core::{settle_core, SettlementParams};

use super::bindings::{verify_bundle, BindingInputs};
use super::helpers::validate_epoch;
use super::VerifyProof;

#[event]
pub struct ProofSettled {
    pub version: u8,
    pub issuer: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub sanctions_root: [u8; 32],
    pub jurisdiction_root: [u8; 32],
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub epoch: u64,
    pub timestamp: u64,
    pub slot: u64,
    pub payer: Pubkey,
}

#[allow(clippy::too_many_arguments)]
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, VerifyProof<'info>>,
    proof_and_witness: Vec<u8>,
    nullifier_hash: [u8; 32],
    mint: Pubkey,
    epoch: u64,
    recipient: Pubkey,
    amount: u64,
    validity_proof: ValidityProof,
    address_tree_info: PackedAddressTreeInfo,
    output_state_tree_index: u8,
) -> Result<()> {
    require!(nullifier_hash != [0u8; 32], ZkSettleError::ZeroNullifier);
    require_keys_eq!(
        ctx.accounts.leaf_owner.key(),
        recipient,
        ZkSettleError::RecipientMismatch
    );

    let clock = Clock::get()?;
    validate_epoch(clock.unix_timestamp, epoch)?;

    let timestamp = u64::try_from(clock.unix_timestamp)
        .map_err(|_| error!(ZkSettleError::NegativeClock))?;

    verify_bundle(
        &proof_and_witness,
        &BindingInputs {
            merkle_root: &ctx.accounts.issuer.merkle_root,
            nullifier_hash: &nullifier_hash,
            mint: &mint,
            epoch,
            recipient: &recipient,
            amount,
            sanctions_root: &ctx.accounts.issuer.sanctions_root,
            jurisdiction_root: &ctx.accounts.issuer.jurisdiction_root,
            timestamp,
        },
    )?;

    let issuer_key = ctx.accounts.issuer.key();
    let merkle_root = ctx.accounts.issuer.merkle_root;
    let slot = clock.slot;

    settle_core(SettlementParams {
        issuer_key,
        issuer_bytes: issuer_key.to_bytes(),
        nullifier_hash,
        merkle_root,
        sanctions_root: ctx.accounts.issuer.sanctions_root,
        jurisdiction_root: ctx.accounts.issuer.jurisdiction_root,
        mint,
        recipient,
        amount,
        epoch,
        timestamp,
        slot,
        payer_key: ctx.accounts.payer.key(),
        validity_proof,
        address_tree_info,
        output_state_tree_index,
        payer_info: ctx.accounts.payer.as_ref(),
        remaining_accounts: ctx.remaining_accounts,
    })?;

    crate::cu_probe!("post-light-cpi");

    crate::cu_probe!("pre-bubblegum-mint");
    cpi_mint_compliance_attestation(
        ctx.accounts.bubblegum_program.as_ref(),
        ctx.accounts.tree_config.as_ref(),
        ctx.accounts.merkle_tree.as_ref(),
        ctx.accounts.tree_creator.as_ref(),
        ctx.accounts.registry.tree_creator_bump,
        ctx.accounts.compression_program.as_ref(),
        ctx.accounts.log_wrapper.as_ref(),
        ctx.accounts.system_program.as_ref(),
        ctx.accounts.payer.as_ref(),
        ctx.accounts.leaf_owner.as_ref(),
        issuer_key,
        nullifier_hash,
        merkle_root,
        slot,
    )?;
    crate::cu_probe!("post-bubblegum-mint");

    Ok(())
}
