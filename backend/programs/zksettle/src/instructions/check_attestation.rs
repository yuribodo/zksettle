use anchor_lang::prelude::*;
use light_sdk::{
    account::LightAccount,
    cpi::{
        v2::{CpiAccounts, LightSystemProgramCpi},
        InvokeLightSystemProgram, LightCpiInstruction,
    },
    instruction::{account_meta::CompressedAccountMetaReadOnly, ValidityProof},
};

use crate::constants::MAX_ROOT_AGE_SLOTS;
use crate::error::ZkSettleError;
use crate::state::{compressed::CompressedAttestation, Issuer, ISSUER_SEED};

#[derive(Accounts)]
pub struct CheckAttestation<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, issuer.authority.as_ref()],
        bump = issuer.bump,
    )]
    pub issuer: Account<'info, Issuer>,
}

#[event]
pub struct AttestationChecked {
    pub issuer: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub slot: u64,
}

pub fn check_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, CheckAttestation<'info>>,
    nullifier_hash: [u8; 32],
    validity_proof: ValidityProof,
    attestation_meta: CompressedAccountMetaReadOnly,
    compressed_attestation: CompressedAttestation,
) -> Result<()> {
    let slot = Clock::get()?.slot;
    let age = slot.saturating_sub(compressed_attestation.slot);
    require!(age <= MAX_ROOT_AGE_SLOTS, ZkSettleError::AttestationExpired);

    require!(
        compressed_attestation.nullifier_hash == nullifier_hash,
        ZkSettleError::NullifierMismatch
    );
    require!(
        Pubkey::new_from_array(compressed_attestation.issuer) == ctx.accounts.issuer.key(),
        ZkSettleError::UnauthorizedIssuer
    );

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.payer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    let tree_pubkeys = light_cpi_accounts
        .tree_pubkeys()
        .map_err(crate::map_light_err!("tree_pubkeys failed", ZkSettleError::LightTreeLookupFailed))?;

    let read_only = LightAccount::<CompressedAttestation>::new_read_only(
        &crate::ID,
        &attestation_meta,
        compressed_attestation,
        &tree_pubkeys,
    )
    .map_err(crate::map_light_err!("new_read_only failed", ZkSettleError::InvalidLightAddress))?;

    LightSystemProgramCpi::new_cpi(crate::LIGHT_CPI_SIGNER, validity_proof)
        .with_light_account(read_only)
        .map_err(crate::map_light_err!("with_light_account read_only", ZkSettleError::LightAccountPackFailed))?
        .invoke(light_cpi_accounts)
        .map_err(crate::map_light_err!("Light CPI invoke failed", ZkSettleError::LightInvokeFailed))?;

    emit!(AttestationChecked {
        issuer: ctx.accounts.issuer.key(),
        nullifier_hash,
        slot,
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_attestation_within_window() {
        let attestation_slot = 1_000_000u64;
        let current_slot = attestation_slot + MAX_ROOT_AGE_SLOTS;
        let age = current_slot.saturating_sub(attestation_slot);
        assert!(age <= MAX_ROOT_AGE_SLOTS);
    }

    #[test]
    fn expired_attestation_beyond_window() {
        let attestation_slot = 1_000_000u64;
        let current_slot = attestation_slot + MAX_ROOT_AGE_SLOTS + 1;
        let age = current_slot.saturating_sub(attestation_slot);
        assert!(age > MAX_ROOT_AGE_SLOTS);
    }
}
