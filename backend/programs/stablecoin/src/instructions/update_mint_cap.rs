use anchor_lang::prelude::*;

use crate::error::StablecoinError;
use crate::state::{Treasury, TREASURY_SEED};
use crate::EVENT_VERSION;

#[derive(Accounts)]
pub struct UpdateMintCap<'info> {
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
pub struct MintCapUpdated {
    pub version: u8,
    pub admin: Pubkey,
    pub old_cap: u64,
    pub new_cap: u64,
}

pub fn update_mint_cap_handler(ctx: Context<UpdateMintCap>, new_cap: u64) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    let old_cap = treasury.mint_cap;
    require!(new_cap != old_cap, StablecoinError::MintCapUnchanged);
    treasury.mint_cap = new_cap;

    emit!(MintCapUpdated {
        version: EVENT_VERSION,
        admin: ctx.accounts.admin.key(),
        old_cap,
        new_cap,
    });
    Ok(())
}
