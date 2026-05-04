use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint as MintAccount, Token2022, TokenAccount};

use super::cpi_helpers::thaw_token_account;
use crate::error::StablecoinError;
use crate::state::{
    RedemptionRequest, Treasury, ESCROW_AUTHORITY_SEED, FREEZE_AUTHORITY_SEED, TREASURY_SEED,
};
use crate::EVENT_VERSION;

#[derive(Accounts)]
pub struct ApproveRedemption<'info> {
    pub operator: Signer<'info>,

    /// CHECK: receives rent refund when redemption_request is closed.
    #[account(mut)]
    pub holder: UncheckedAccount<'info>,

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

    /// CHECK: PDA signer for burn CPI as delegate.
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
pub struct RedemptionApproved {
    pub version: u8,
    pub mint: Pubkey,
    pub holder: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub operator: Pubkey,
}

pub fn approve_redemption_handler(ctx: Context<ApproveRedemption>) -> Result<()> {
    require!(!ctx.accounts.treasury.paused, StablecoinError::Paused);

    let treasury_key = ctx.accounts.treasury.key();
    let amount = ctx.accounts.redemption_request.amount;
    let nonce = ctx.accounts.redemption_request.nonce;

    thaw_token_account(
        &ctx.accounts.holder_token_account,
        &ctx.accounts.mint,
        &ctx.accounts.freeze_authority,
        &ctx.accounts.token_program,
        &treasury_key,
        ctx.accounts.treasury.freeze_authority_bump,
    )?;

    let escrow_bump = [ctx.accounts.treasury.escrow_authority_bump];
    let escrow_seeds: &[&[u8]] = &[ESCROW_AUTHORITY_SEED, treasury_key.as_ref(), &escrow_bump];
    let cpi_accounts = token_2022::Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.holder_token_account.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    token_2022::burn(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        &[escrow_seeds],
    ), amount)?;

    let treasury = &mut ctx.accounts.treasury;
    treasury.total_burned = treasury
        .total_burned
        .checked_add(amount)
        .ok_or(StablecoinError::CounterOverflow)?;

    emit!(RedemptionApproved {
        version: EVENT_VERSION,
        mint: ctx.accounts.mint.key(),
        holder: ctx.accounts.holder.key(),
        amount,
        nonce,
        operator: ctx.accounts.operator.key(),
    });
    Ok(())
}
