use anchor_lang::prelude::*;

use crate::error::StablecoinError;
use crate::state::{Treasury, TREASURY_SEED};
use crate::EVENT_VERSION;

#[derive(Accounts)]
pub struct SetOperator<'info> {
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
pub struct OperatorUpdated {
    pub version: u8,
    pub admin: Pubkey,
    pub old_operator: Pubkey,
    pub new_operator: Pubkey,
}

pub fn set_operator_handler(ctx: Context<SetOperator>, new_operator: Pubkey) -> Result<()> {
    require!(
        new_operator != Pubkey::default(),
        StablecoinError::InvalidNewOperator
    );

    let treasury = &mut ctx.accounts.treasury;
    require!(new_operator != treasury.operator, StablecoinError::OperatorAlreadyCurrent);
    let old_operator = treasury.operator;
    treasury.operator = new_operator;

    emit!(OperatorUpdated {
        version: EVENT_VERSION,
        admin: ctx.accounts.admin.key(),
        old_operator,
        new_operator,
    });
    Ok(())
}
