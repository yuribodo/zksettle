mod bindings;
mod handler;
mod helpers;
#[cfg(test)]
mod tests;

use anchor_lang::prelude::*;

use crate::error::ZkSettleError;
use crate::instructions::bubblegum_mint::{tree_config_pda, MPL_BUBBLEGUM_ID, NOOP_PROGRAM_ID};
use crate::state::{BubblegumTreeRegistry, Issuer, BUBBLEGUM_REGISTRY_SEED, BUBBLEGUM_TREE_CREATOR_SEED, ISSUER_SEED};

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

    #[account(seeds = [BUBBLEGUM_REGISTRY_SEED], bump)]
    pub registry: Account<'info, BubblegumTreeRegistry>,

    /// CHECK: Bubblegum leaf owner; must equal instruction `recipient` (validated in handler).
    pub leaf_owner: UncheckedAccount<'info>,

    /// CHECK: must match `registry.merkle_tree`.
    #[account(mut, address = registry.merkle_tree)]
    pub merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Bubblegum `TreeConfig` PDA.
    #[account(
        mut,
        constraint = tree_config.key() == tree_config_pda(&registry.merkle_tree).0 @ ZkSettleError::BubblegumCpiFailed
    )]
    pub tree_config: UncheckedAccount<'info>,

    #[account(
        seeds = [BUBBLEGUM_TREE_CREATOR_SEED],
        bump = registry.tree_creator_bump
    )]
    pub tree_creator: AccountInfo<'info>,

    /// CHECK: mpl-bubblegum program id.
    #[account(address = MPL_BUBBLEGUM_ID)]
    pub bubblegum_program: UncheckedAccount<'info>,

    /// CHECK: SPL account compression program id.
    #[account(address = spl_account_compression::ID)]
    pub compression_program: UncheckedAccount<'info>,

    /// CHECK: SPL noop (log wrapper).
    #[account(address = NOOP_PROGRAM_ID)]
    pub log_wrapper: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
