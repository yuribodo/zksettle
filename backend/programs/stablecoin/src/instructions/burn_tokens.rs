use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint as MintAccount, Token2022, TokenAccount};

use crate::error::StablecoinError;
use crate::state::{Treasury, TREASURY_SEED};

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub holder: Signer<'info>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, treasury.mint.as_ref()],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        mut,
        constraint = mint.key() == treasury.mint @ StablecoinError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, MintAccount>,

    #[account(
        mut,
        constraint = token_account.mint == treasury.mint @ StablecoinError::MintMismatch,
        constraint = token_account.owner == holder.key() @ StablecoinError::UnauthorizedHolder,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
}

// Any holder can burn their own tokens. total_burned includes user-initiated burns by design.
pub fn burn_tokens_handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, StablecoinError::ZeroBurnAmount);

    let cpi_accounts = token_2022::Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.token_account.to_account_info(),
        authority: ctx.accounts.holder.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );
    token_2022::burn(cpi_ctx, amount)?;

    let treasury = &mut ctx.accounts.treasury;
    treasury.total_burned = treasury
        .total_burned
        .checked_add(amount)
        .ok_or(StablecoinError::CounterOverflow)?;

    msg!("Burned {} tokens", amount);
    Ok(())
}
