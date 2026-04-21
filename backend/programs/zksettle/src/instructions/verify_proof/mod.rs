mod bindings;
mod handler;
mod helpers;
#[cfg(test)]
mod tests;

use anchor_lang::prelude::*;

use crate::error::ZkSettleError;
use crate::state::{Issuer, ISSUER_SEED};

pub(crate) use bindings::{verify_bundle, BindingInputs};
pub use handler::{handler, ProofSettled};
pub use helpers::{pubkey_to_limbs, u64_to_field_bytes, EPOCH_LEN_SECS, MAX_EPOCH_LAG};
pub(crate) use helpers::validate_epoch;

#[derive(Accounts)]
pub struct VerifyProof<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, issuer.authority.as_ref()],
        bump = issuer.bump,
        constraint = Clock::get()?.slot.saturating_sub(issuer.root_slot) <= crate::constants::MAX_ROOT_AGE_SLOTS
            @ ZkSettleError::RootStale,
    )]
    pub issuer: Account<'info, Issuer>,

    pub system_program: Program<'info, System>,
}
