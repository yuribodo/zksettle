use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint as MintAccount, Token2022, TokenAccount};

use crate::error::StablecoinError;
use crate::state::{Treasury, MINT_AUTHORITY_SEED, TREASURY_SEED};

#[derive(Accounts)]
pub struct MintTokens<'info> {
    pub operator: Signer<'info>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, treasury.mint.as_ref()],
        bump = treasury.bump,
        has_one = operator @ StablecoinError::UnauthorizedOperator,
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        mut,
        constraint = mint.key() == treasury.mint @ StablecoinError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, MintAccount>,

    /// CHECK: PDA signer for mint_to CPI.
    #[account(
        seeds = [MINT_AUTHORITY_SEED, treasury.key().as_ref()],
        bump = treasury.mint_authority_bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = destination.mint == treasury.mint @ StablecoinError::MintMismatch,
    )]
    pub destination: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, StablecoinError::ZeroMintAmount);

    let treasury_key = ctx.accounts.treasury.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        MINT_AUTHORITY_SEED,
        treasury_key.as_ref(),
        &[ctx.accounts.treasury.mint_authority_bump],
    ]];

    let cpi_accounts = token_2022::MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.destination.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token_2022::mint_to(cpi_ctx, amount)?;

    let treasury = &mut ctx.accounts.treasury;
    treasury.total_minted = treasury
        .total_minted
        .checked_add(amount)
        .ok_or(StablecoinError::CounterOverflow)?;

    msg!("Minted {} tokens", amount);
    Ok(())
}
