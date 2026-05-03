use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint as MintAccount, Token2022, TokenAccount};

use crate::error::StablecoinError;
use crate::state::{Treasury, FREEZE_AUTHORITY_SEED, TREASURY_SEED};
use crate::EVENT_VERSION;

#[derive(Accounts)]
pub struct FreezeOrThaw<'info> {
    pub admin: Signer<'info>,

    #[account(
        seeds = [TREASURY_SEED, treasury.mint.as_ref()],
        bump = treasury.bump,
        has_one = admin @ StablecoinError::UnauthorizedAdmin,
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        constraint = mint.key() == treasury.mint @ StablecoinError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, MintAccount>,

    /// CHECK: PDA signer for freeze/thaw CPI.
    #[account(
        seeds = [FREEZE_AUTHORITY_SEED, treasury.key().as_ref()],
        bump = treasury.freeze_authority_bump,
    )]
    pub freeze_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = target_account.mint == treasury.mint @ StablecoinError::MintMismatch,
    )]
    pub target_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
}

#[event]
pub struct AccountFrozen {
    pub version: u8,
    pub mint: Pubkey,
    pub token_account: Pubkey,
    pub admin: Pubkey,
}

#[event]
pub struct AccountThawed {
    pub version: u8,
    pub mint: Pubkey,
    pub token_account: Pubkey,
    pub admin: Pubkey,
}

fn signer_seeds<'a>(treasury_key: &'a [u8], bump: &'a [u8]) -> [&'a [u8]; 3] {
    [FREEZE_AUTHORITY_SEED, treasury_key, bump]
}

pub fn freeze_handler(ctx: Context<FreezeOrThaw>) -> Result<()> {
    require!(!ctx.accounts.treasury.paused, StablecoinError::Paused);

    let treasury_key = ctx.accounts.treasury.key();
    let bump = [ctx.accounts.treasury.freeze_authority_bump];
    let seeds = signer_seeds(treasury_key.as_ref(), &bump);
    let signer_seeds: &[&[&[u8]]] = &[&seeds];

    let cpi_accounts = token_2022::FreezeAccount {
        account: ctx.accounts.target_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.freeze_authority.to_account_info(),
    };
    token_2022::freeze_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    ))?;

    emit!(AccountFrozen {
        version: EVENT_VERSION,
        mint: ctx.accounts.mint.key(),
        token_account: ctx.accounts.target_account.key(),
        admin: ctx.accounts.admin.key(),
    });
    Ok(())
}

// Thaw is exempt from pause guard — emergency unfreeze of wrongly-frozen accounts must work while paused.
pub fn thaw_handler(ctx: Context<FreezeOrThaw>) -> Result<()> {
    let treasury_key = ctx.accounts.treasury.key();
    let bump = [ctx.accounts.treasury.freeze_authority_bump];
    let seeds = signer_seeds(treasury_key.as_ref(), &bump);
    let signer_seeds: &[&[&[u8]]] = &[&seeds];

    let cpi_accounts = token_2022::ThawAccount {
        account: ctx.accounts.target_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.freeze_authority.to_account_info(),
    };
    token_2022::thaw_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    ))?;

    emit!(AccountThawed {
        version: EVENT_VERSION,
        mint: ctx.accounts.mint.key(),
        token_account: ctx.accounts.target_account.key(),
        admin: ctx.accounts.admin.key(),
    });
    Ok(())
}
