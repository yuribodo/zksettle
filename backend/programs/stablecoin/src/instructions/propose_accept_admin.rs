use anchor_lang::prelude::*;

use crate::error::StablecoinError;
use crate::state::{Treasury, TREASURY_SEED};
use crate::EVENT_VERSION;

#[derive(Accounts)]
pub struct ProposeAdmin<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, treasury.mint.as_ref()],
        bump = treasury.bump,
        has_one = admin @ StablecoinError::UnauthorizedAdmin,
        realloc = 8 + Treasury::LEN,
        realloc::payer = admin,
        realloc::zero = false,
    )]
    pub treasury: Account<'info, Treasury>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    pub new_admin: Signer<'info>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, treasury.mint.as_ref()],
        bump = treasury.bump,
        constraint = treasury.pending_admin == Some(new_admin.key()) @ StablecoinError::NotPendingAdmin,
    )]
    pub treasury: Account<'info, Treasury>,
}

#[event]
pub struct AdminProposed {
    pub version: u8,
    pub current_admin: Pubkey,
    pub proposed_admin: Pubkey,
}

#[event]
pub struct AdminAccepted {
    pub version: u8,
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
}

#[derive(Accounts)]
pub struct CancelPendingAdmin<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, treasury.mint.as_ref()],
        bump = treasury.bump,
        has_one = admin @ StablecoinError::UnauthorizedAdmin,
    )]
    pub treasury: Account<'info, Treasury>,
}

#[event]
pub struct PendingAdminCancelled {
    pub version: u8,
    pub admin: Pubkey,
    pub cancelled_pending: Pubkey,
}

pub fn cancel_pending_admin_handler(ctx: Context<CancelPendingAdmin>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    let pending = treasury.pending_admin.ok_or(error!(StablecoinError::NoPendingAdmin))?;

    emit!(PendingAdminCancelled {
        version: EVENT_VERSION,
        admin: treasury.admin,
        cancelled_pending: pending,
    });

    treasury.pending_admin = None;
    Ok(())
}

pub fn propose_admin_handler(ctx: Context<ProposeAdmin>, new_admin: Pubkey) -> Result<()> {
    require!(new_admin != Pubkey::default(), StablecoinError::InvalidNewAdmin);

    let treasury = &mut ctx.accounts.treasury;
    require!(new_admin != treasury.admin, StablecoinError::AdminAlreadyCurrent);

    emit!(AdminProposed {
        version: EVENT_VERSION,
        current_admin: treasury.admin,
        proposed_admin: new_admin,
    });

    treasury.pending_admin = Some(new_admin);
    Ok(())
}

pub fn accept_admin_handler(ctx: Context<AcceptAdmin>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    let old_admin = treasury.admin;

    treasury.admin = ctx.accounts.new_admin.key();
    treasury.pending_admin = None;

    emit!(AdminAccepted {
        version: EVENT_VERSION,
        old_admin,
        new_admin: ctx.accounts.new_admin.key(),
    });
    Ok(())
}
