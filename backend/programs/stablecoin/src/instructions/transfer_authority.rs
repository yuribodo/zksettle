use anchor_lang::prelude::*;

use crate::error::StablecoinError;
use crate::state::{Treasury, TREASURY_SEED};

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, treasury.mint.as_ref()],
        bump = treasury.bump,
        has_one = admin @ StablecoinError::UnauthorizedAdmin,
    )]
    pub treasury: Account<'info, Treasury>,
}

pub fn handler(
    ctx: Context<TransferAuthority>,
    new_admin: Option<Pubkey>,
    new_operator: Option<Pubkey>,
) -> Result<()> {
    require!(
        new_admin.is_some() || new_operator.is_some(),
        StablecoinError::NoAuthorityChange
    );

    let treasury = &mut ctx.accounts.treasury;

    if let Some(admin) = new_admin {
        require!(admin != Pubkey::default(), StablecoinError::InvalidNewAdmin);
        msg!("Admin transferred: {} -> {}", treasury.admin, admin);
        treasury.admin = admin;
    }

    if let Some(operator) = new_operator {
        require!(
            operator != Pubkey::default(),
            StablecoinError::InvalidNewOperator
        );
        msg!("Operator transferred: {} -> {}", treasury.operator, operator);
        treasury.operator = operator;
    }

    Ok(())
}
