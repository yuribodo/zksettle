use anchor_lang::prelude::*;

use crate::constants::MAX_ROOT_AGE_SLOTS;
use crate::error::ZkSettleError;
use crate::state::{Attestation, Issuer, ATTESTATION_SEED, ISSUER_SEED};

#[derive(Accounts)]
#[instruction(nullifier_hash: [u8; 32])]
pub struct CheckAttestation<'info> {
    #[account(
        seeds = [ISSUER_SEED, issuer.authority.as_ref()],
        bump = issuer.bump,
    )]
    pub issuer: Account<'info, Issuer>,

    #[account(
        seeds = [ATTESTATION_SEED, issuer.key().as_ref(), nullifier_hash.as_ref()],
        bump = attestation.bump,
    )]
    pub attestation: Account<'info, Attestation>,
}

#[event]
pub struct AttestationChecked {
    pub issuer: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub slot: u64,
}

pub fn check_handler(
    ctx: Context<CheckAttestation>,
    nullifier_hash: [u8; 32],
) -> Result<()> {
    let slot = Clock::get()?.slot;
    let age = slot.saturating_sub(ctx.accounts.attestation.slot);

    require!(
        age <= MAX_ROOT_AGE_SLOTS,
        ZkSettleError::AttestationExpired
    );

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
