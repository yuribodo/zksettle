use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_interface::Token2022;

use crate::error::StablecoinError;
use crate::state::{Treasury, FREEZE_AUTHORITY_SEED, MINT_AUTHORITY_SEED, TREASURY_SEED};

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Validated by initialize_mint2 CPI — has extensions allocated but is not yet
    /// initialized as a mint, so Anchor cannot deserialize it.
    #[account(
        mut,
        constraint = *mint.owner == token_program.key() @ StablecoinError::MintMismatch,
    )]
    pub mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Treasury::LEN,
        seeds = [TREASURY_SEED, mint.key().as_ref()],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    /// CHECK: PDA used as mint authority — not read or written, only its address matters.
    #[account(
        seeds = [MINT_AUTHORITY_SEED, treasury.key().as_ref()],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    /// CHECK: PDA used as freeze authority — not read or written, only its address matters.
    #[account(
        seeds = [FREEZE_AUTHORITY_SEED, treasury.key().as_ref()],
        bump,
    )]
    pub freeze_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_mint_handler(ctx: Context<InitializeMint>, decimals: u8) -> Result<()> {
    let cpi_accounts = token_2022::InitializeMint2 {
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );
    token_2022::initialize_mint2(
        cpi_ctx,
        decimals,
        &ctx.accounts.mint_authority.key(),
        Some(&ctx.accounts.freeze_authority.key()),
    )?;

    let treasury = &mut ctx.accounts.treasury;
    treasury.admin = ctx.accounts.admin.key();
    treasury.operator = ctx.accounts.admin.key();
    treasury.mint = ctx.accounts.mint.key();
    treasury.mint_authority_bump = ctx.bumps.mint_authority;
    treasury.freeze_authority_bump = ctx.bumps.freeze_authority;
    treasury.bump = ctx.bumps.treasury;
    treasury.total_minted = 0;
    treasury.total_burned = 0;
    treasury.decimals = decimals;
    treasury.paused = false;
    treasury.pending_admin = None;

    msg!("Stablecoin mint initialized with {} decimals", decimals);
    Ok(())
}
