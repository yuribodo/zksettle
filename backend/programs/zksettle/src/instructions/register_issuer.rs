use anchor_lang::prelude::*;

use crate::error::ZkSettleError;
use crate::state::{Issuer, ISSUER_SEED};

#[derive(Accounts)]
pub struct RegisterIssuer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Issuer::LEN,
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump,
    )]
    pub issuer: Account<'info, Issuer>,

    pub system_program: Program<'info, System>,
}

pub fn register_handler(ctx: Context<RegisterIssuer>, merkle_root: [u8; 32]) -> Result<()> {
    require!(merkle_root != [0u8; 32], ZkSettleError::ZeroMerkleRoot);

    let issuer = &mut ctx.accounts.issuer;
    issuer.authority = ctx.accounts.authority.key();
    issuer.merkle_root = merkle_root;
    issuer.root_slot = Clock::get()?.slot;
    issuer.bump = ctx.bumps.issuer;

    msg!("Issuer registered at slot {}", issuer.root_slot);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateIssuerRoot<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority @ ZkSettleError::UnauthorizedIssuer,
    )]
    pub issuer: Account<'info, Issuer>,
}

pub fn update_handler(ctx: Context<UpdateIssuerRoot>, merkle_root: [u8; 32]) -> Result<()> {
    require!(merkle_root != [0u8; 32], ZkSettleError::ZeroMerkleRoot);

    let issuer = &mut ctx.accounts.issuer;
    issuer.merkle_root = merkle_root;
    issuer.root_slot = Clock::get()?.slot;

    msg!("Issuer root updated at slot {}", issuer.root_slot);
    Ok(())
}
