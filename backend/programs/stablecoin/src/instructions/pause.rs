use anchor_lang::prelude::*;

use crate::error::StablecoinError;
use crate::state::{Treasury, TREASURY_SEED};

#[derive(Accounts)]
pub struct PauseOrUnpause<'info> {
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
pub struct Paused {
    pub admin: Pubkey,
}

#[event]
pub struct Unpaused {
    pub admin: Pubkey,
}

pub fn pause_handler(ctx: Context<PauseOrUnpause>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    require!(!treasury.paused, StablecoinError::AlreadyInState);
    treasury.paused = true;

    emit!(Paused {
        admin: ctx.accounts.admin.key(),
    });
    Ok(())
}

pub fn unpause_handler(ctx: Context<PauseOrUnpause>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    require!(treasury.paused, StablecoinError::AlreadyInState);
    treasury.paused = false;

    emit!(Unpaused {
        admin: ctx.accounts.admin.key(),
    });
    Ok(())
}
