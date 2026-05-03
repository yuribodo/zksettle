use anchor_lang::prelude::*;

use crate::error::StablecoinError;
use crate::state::{Treasury, TREASURY_SEED};
use crate::EVENT_VERSION;

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
    pub version: u8,
    pub admin: Pubkey,
}

#[event]
pub struct Unpaused {
    pub version: u8,
    pub admin: Pubkey,
}

pub fn pause_handler(ctx: Context<PauseOrUnpause>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    require!(!treasury.paused, StablecoinError::AlreadyInState);
    treasury.paused = true;

    emit!(Paused {
        version: EVENT_VERSION,
        admin: ctx.accounts.admin.key(),
    });
    Ok(())
}

pub fn unpause_handler(ctx: Context<PauseOrUnpause>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    require!(treasury.paused, StablecoinError::AlreadyInState);
    treasury.paused = false;

    emit!(Unpaused {
        version: EVENT_VERSION,
        admin: ctx.accounts.admin.key(),
    });
    Ok(())
}
