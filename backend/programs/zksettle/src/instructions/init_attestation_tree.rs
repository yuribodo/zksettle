//! One-time Bubblegum + concurrent merkle tree setup for ADR-019 attestation cNFTs.

use anchor_lang::prelude::*;

use crate::constants::{BUBBLEGUM_MAX_BUFFER_SIZE, BUBBLEGUM_MAX_DEPTH};
use crate::error::ZkSettleError;
use crate::instructions::bubblegum_mint::{
    bubblegum_merkle_tree_account_size, invoke_create_tree_config, tree_config_pda, MPL_BUBBLEGUM_ID,
    NOOP_PROGRAM_ID,
};
use crate::state::{
    BubblegumTreeRegistry, Issuer, BUBBLEGUM_REGISTRY_SEED, BUBBLEGUM_TREE_CREATOR_SEED, ISSUER_SEED,
};
use spl_account_compression::ID as SPL_ACCOUNT_COMPRESSION_ID;

#[derive(Accounts)]
pub struct InitAttestationTree<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority @ ZkSettleError::UnauthorizedIssuer,
    )]
    pub issuer: Account<'info, Issuer>,

    #[account(
        init,
        payer = authority,
        space = 8 + BubblegumTreeRegistry::INIT_SPACE,
        seeds = [BUBBLEGUM_REGISTRY_SEED],
        bump
    )]
    pub registry: Account<'info, BubblegumTreeRegistry>,

    #[account(mut)]
    pub merkle_tree: Signer<'info>,

    /// CHECK: Bubblegum `TreeConfig` PDA (created by Bubblegum CPI).
    #[account(mut)]
    pub tree_config: UncheckedAccount<'info>,

    /// CHECK: PDA signer for Bubblegum `CreateTreeConfig` CPI; seed-constrained.
    #[account(seeds = [BUBBLEGUM_TREE_CREATOR_SEED], bump)]
    pub tree_creator: AccountInfo<'info>,

    /// CHECK: Metaplex Bubblegum program id.
    #[account(address = MPL_BUBBLEGUM_ID)]
    pub bubblegum_program: UncheckedAccount<'info>,

    /// CHECK: SPL account compression program id.
    #[account(address = SPL_ACCOUNT_COMPRESSION_ID)]
    pub compression_program: UncheckedAccount<'info>,

    /// CHECK: SPL noop program; address-constrained.
    #[account(address = NOOP_PROGRAM_ID)]
    pub log_wrapper: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn init_handler(ctx: Context<InitAttestationTree>) -> Result<()> {
    let (expected_cfg, _) = tree_config_pda(&ctx.accounts.merkle_tree.key());
    require_keys_eq!(
        ctx.accounts.tree_config.key(),
        expected_cfg,
        ZkSettleError::BubblegumCpiFailed
    );

    // Merkle tree account must be pre-allocated client-side (>10KB exceeds
    // inner-instruction realloc limit).
    let tree_info = ctx.accounts.merkle_tree.to_account_info();
    let expected_space = bubblegum_merkle_tree_account_size();
    require!(
        tree_info.data_len() >= expected_space,
        ZkSettleError::MerkleTreeTooSmall
    );
    require!(
        *tree_info.owner == SPL_ACCOUNT_COMPRESSION_ID,
        ZkSettleError::MerkleTreeWrongOwner
    );

    let bump = ctx.bumps.tree_creator;
    let seeds: &[&[u8]] = &[BUBBLEGUM_TREE_CREATOR_SEED, &[bump]];
    invoke_create_tree_config(
        ctx.accounts.bubblegum_program.as_ref(),
        ctx.accounts.tree_config.as_ref(),
        ctx.accounts.merkle_tree.as_ref(),
        ctx.accounts.authority.as_ref(),
        ctx.accounts.tree_creator.as_ref(),
        ctx.accounts.log_wrapper.as_ref(),
        ctx.accounts.compression_program.as_ref(),
        ctx.accounts.system_program.as_ref(),
        BUBBLEGUM_MAX_DEPTH,
        BUBBLEGUM_MAX_BUFFER_SIZE,
        &[seeds],
    )?;

    let registry = &mut ctx.accounts.registry;
    registry.merkle_tree = ctx.accounts.merkle_tree.key();
    registry.tree_creator_bump = bump;
    Ok(())
}
