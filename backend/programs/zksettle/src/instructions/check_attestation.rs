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

pub(crate) fn validate_attestation(
    current_slot: u64,
    attestation: &CompressedAttestation,
    nullifier_hash: &[u8; 32],
    issuer_key: &Pubkey,
) -> Result<()> {
    let age = current_slot.saturating_sub(attestation.slot);
    require!(age <= MAX_ROOT_AGE_SLOTS, ZkSettleError::AttestationExpired);
    require!(
        attestation.nullifier_hash == *nullifier_hash,
        ZkSettleError::NullifierMismatch
    );
    require!(
        Pubkey::new_from_array(attestation.issuer) == *issuer_key,
        ZkSettleError::UnauthorizedIssuer
    );
    Ok(())
}

pub fn check_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, CheckAttestation<'info>>,
    nullifier_hash: [u8; 32],
    validity_proof: ValidityProof,
    attestation_meta: CompressedAccountMetaReadOnly,
    compressed_attestation: CompressedAttestation,
) -> Result<()> {
    let slot = Clock::get()?.slot;
    validate_attestation(slot, &compressed_attestation, &nullifier_hash, &ctx.accounts.issuer.key())?;

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
    use anchor_lang::error::ERROR_CODE_OFFSET;

    fn err_code<T: std::fmt::Debug>(r: Result<T>) -> u32 {
        match r {
            Err(anchor_lang::error::Error::AnchorError(e)) => e.error_code_number,
            other => panic!("expected AnchorError, got {other:?}"),
        }
    }

    fn sample_attestation(slot: u64, issuer: &Pubkey, nullifier: [u8; 32]) -> CompressedAttestation {
        CompressedAttestation {
            issuer: issuer.to_bytes(),
            nullifier_hash: nullifier,
            merkle_root: [0u8; 32],
            mint: [0u8; 32],
            recipient: [0u8; 32],
            amount: 100,
            epoch: 1,
            slot,
            payer: [0u8; 32],
        }
    }

    #[test]
    fn accepts_fresh_matching() {
        let issuer = Pubkey::new_unique();
        let nullifier = [7u8; 32];
        let att = sample_attestation(1_000_000, &issuer, nullifier);
        let current_slot = 1_000_000 + MAX_ROOT_AGE_SLOTS;
        assert!(validate_attestation(current_slot, &att, &nullifier, &issuer).is_ok());
    }

    #[test]
    fn rejects_expired() {
        let issuer = Pubkey::new_unique();
        let nullifier = [7u8; 32];
        let att = sample_attestation(1_000_000, &issuer, nullifier);
        let current_slot = 1_000_000 + MAX_ROOT_AGE_SLOTS + 1;
        assert_eq!(
            err_code(validate_attestation(current_slot, &att, &nullifier, &issuer)),
            ERROR_CODE_OFFSET + ZkSettleError::AttestationExpired as u32,
        );
    }

    #[test]
    fn accepts_at_max_age() {
        let issuer = Pubkey::new_unique();
        let nullifier = [7u8; 32];
        let att = sample_attestation(500, &issuer, nullifier);
        let current_slot = 500 + MAX_ROOT_AGE_SLOTS;
        assert!(validate_attestation(current_slot, &att, &nullifier, &issuer).is_ok());
    }

    #[test]
    fn rejects_one_past_max_age() {
        let issuer = Pubkey::new_unique();
        let nullifier = [7u8; 32];
        let att = sample_attestation(500, &issuer, nullifier);
        let current_slot = 500 + MAX_ROOT_AGE_SLOTS + 1;
        assert_eq!(
            err_code(validate_attestation(current_slot, &att, &nullifier, &issuer)),
            ERROR_CODE_OFFSET + ZkSettleError::AttestationExpired as u32,
        );
    }

    #[test]
    fn rejects_nullifier_mismatch() {
        let issuer = Pubkey::new_unique();
        let nullifier = [7u8; 32];
        let wrong_nullifier = [8u8; 32];
        let att = sample_attestation(1_000, &issuer, nullifier);
        assert_eq!(
            err_code(validate_attestation(1_000, &att, &wrong_nullifier, &issuer)),
            ERROR_CODE_OFFSET + ZkSettleError::NullifierMismatch as u32,
        );
    }

    #[test]
    fn rejects_wrong_issuer() {
        let issuer = Pubkey::new_unique();
        let wrong_issuer = Pubkey::new_unique();
        let nullifier = [7u8; 32];
        let att = sample_attestation(1_000, &issuer, nullifier);
        assert_eq!(
            err_code(validate_attestation(1_000, &att, &nullifier, &wrong_issuer)),
            ERROR_CODE_OFFSET + ZkSettleError::UnauthorizedIssuer as u32,
        );
    }

    #[test]
    fn saturating_sub_at_zero() {
        let issuer = Pubkey::new_unique();
        let nullifier = [7u8; 32];
        let att = sample_attestation(100, &issuer, nullifier);
        assert!(validate_attestation(0, &att, &nullifier, &issuer).is_ok());
    }
}
