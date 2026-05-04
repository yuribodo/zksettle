use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint as MintAccount, Token2022, TokenAccount};

use super::cpi_helpers::thaw_token_account;
use crate::error::StablecoinError;
use crate::state::{
    RedemptionRequest, Treasury, ESCROW_AUTHORITY_SEED, FREEZE_AUTHORITY_SEED,
    REDEMPTION_EXPIRY_SECS, TREASURY_SEED,
};
use crate::EVENT_VERSION;

#[derive(Accounts)]
pub struct CancelRedemption<'info> {
    pub canceller: Signer<'info>,

    /// CHECK: receives rent refund when redemption_request is closed.
    #[account(mut)]
    pub holder: UncheckedAccount<'info>,

    #[account(
        seeds = [TREASURY_SEED, treasury.mint.as_ref()],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        constraint = mint.key() == treasury.mint @ StablecoinError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, MintAccount>,

    #[account(
        mut,
        close = holder,
        has_one = treasury,
        has_one = holder,
        has_one = mint,
    )]
    pub redemption_request: Account<'info, RedemptionRequest>,

    #[account(
        mut,
        constraint = holder_token_account.key() == redemption_request.token_account @ StablecoinError::TokenAccountMismatch,
        constraint = holder_token_account.mint == treasury.mint @ StablecoinError::MintMismatch,
        constraint = holder_token_account.owner == holder.key() @ StablecoinError::UnauthorizedHolder,
    )]
    pub holder_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA used as delegate authority; needed for revoke CPI.
    #[account(
        seeds = [ESCROW_AUTHORITY_SEED, treasury.key().as_ref()],
        bump = treasury.escrow_authority_bump,
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    /// CHECK: PDA signer for thaw CPI.
    #[account(
        seeds = [FREEZE_AUTHORITY_SEED, treasury.key().as_ref()],
        bump = treasury.freeze_authority_bump,
    )]
    pub freeze_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

#[event]
pub struct RedemptionCancelled {
    pub version: u8,
    pub mint: Pubkey,
    pub holder: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub canceller: Pubkey,
}

pub fn cancel_redemption_handler(ctx: Context<CancelRedemption>) -> Result<()> {
    let canceller = ctx.accounts.canceller.key();
    let holder = ctx.accounts.redemption_request.holder;
    let admin = ctx.accounts.treasury.admin;

    let is_holder = canceller == holder;
    let is_admin = canceller == admin;
    let is_expired = {
        let clock = Clock::get()?;
        clock.unix_timestamp
            .checked_sub(ctx.accounts.redemption_request.requested_at)
            .map_or(false, |elapsed| elapsed >= REDEMPTION_EXPIRY_SECS)
    };

    require!(
        is_holder || is_admin || is_expired,
        StablecoinError::UnauthorizedCanceller
    );

    let treasury_key = ctx.accounts.treasury.key();
    thaw_token_account(
        &ctx.accounts.holder_token_account,
        &ctx.accounts.mint,
        &ctx.accounts.freeze_authority,
        &ctx.accounts.token_program,
        &treasury_key,
        ctx.accounts.treasury.freeze_authority_bump,
    )?;

    if is_holder {
        let cpi_accounts = token_2022::Revoke {
            source: ctx.accounts.holder_token_account.to_account_info(),
            authority: ctx.accounts.canceller.to_account_info(),
        };
        token_2022::revoke(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        ))?;
    }

    let amount = ctx.accounts.redemption_request.amount;
    let nonce = ctx.accounts.redemption_request.nonce;

    emit!(RedemptionCancelled {
        version: EVENT_VERSION,
        mint: ctx.accounts.mint.key(),
        holder,
        amount,
        nonce,
        canceller,
    });
    Ok(())
}
