use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint as MintAccount, Token2022, TokenAccount};

use crate::error::StablecoinError;
use crate::state::{
    RedemptionRequest, Treasury, ESCROW_AUTHORITY_SEED, FREEZE_AUTHORITY_SEED, REDEMPTION_SEED,
    TREASURY_SEED,
};
use crate::EVENT_VERSION;

#[derive(Accounts)]
pub struct RequestRedemption<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    #[account(
        mut,
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
        constraint = holder_token_account.mint == treasury.mint @ StablecoinError::MintMismatch,
        constraint = holder_token_account.owner == holder.key() @ StablecoinError::UnauthorizedHolder,
    )]
    pub holder_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = holder,
        space = 8 + RedemptionRequest::LEN,
        seeds = [
            REDEMPTION_SEED,
            treasury.key().as_ref(),
            holder.key().as_ref(),
            treasury.redemption_nonce.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub redemption_request: Account<'info, RedemptionRequest>,

    /// CHECK: PDA used as delegate authority for approve_checked CPI.
    #[account(
        seeds = [ESCROW_AUTHORITY_SEED, treasury.key().as_ref()],
        bump = treasury.escrow_authority_bump,
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    /// CHECK: PDA signer for freeze CPI.
    #[account(
        seeds = [FREEZE_AUTHORITY_SEED, treasury.key().as_ref()],
        bump = treasury.freeze_authority_bump,
    )]
    pub freeze_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct RedemptionRequested {
    pub version: u8,
    pub mint: Pubkey,
    pub holder: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub redemption_request: Pubkey,
}

pub fn request_redemption_handler(ctx: Context<RequestRedemption>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.treasury.paused, StablecoinError::Paused);
    require!(amount > 0, StablecoinError::ZeroRedemptionAmount);
    require!(
        !ctx.accounts.holder_token_account.is_frozen(),
        StablecoinError::AccountAlreadyFrozen
    );
    require!(
        ctx.accounts.holder_token_account.amount >= amount,
        StablecoinError::InsufficientBalance
    );

    let treasury_key = ctx.accounts.treasury.key();
    let decimals = ctx.accounts.treasury.decimals;
    let nonce = ctx.accounts.treasury.redemption_nonce;

    let cpi_accounts = token_2022::ApproveChecked {
        to: ctx.accounts.holder_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        delegate: ctx.accounts.escrow_authority.to_account_info(),
        authority: ctx.accounts.holder.to_account_info(),
    };
    token_2022::approve_checked(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        amount,
        decimals,
    )?;

    let freeze_bump = [ctx.accounts.treasury.freeze_authority_bump];
    let freeze_seeds: &[&[u8]] = &[FREEZE_AUTHORITY_SEED, treasury_key.as_ref(), &freeze_bump];
    let cpi_accounts = token_2022::FreezeAccount {
        account: ctx.accounts.holder_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.freeze_authority.to_account_info(),
    };
    token_2022::freeze_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        &[freeze_seeds],
    ))?;

    let clock = Clock::get()?;
    let req = &mut ctx.accounts.redemption_request;
    req.holder = ctx.accounts.holder.key();
    req.treasury = treasury_key;
    req.mint = ctx.accounts.mint.key();
    req.token_account = ctx.accounts.holder_token_account.key();
    req.amount = amount;
    req.nonce = nonce;
    req.requested_at = clock.unix_timestamp;
    req.bump = ctx.bumps.redemption_request;

    let treasury = &mut ctx.accounts.treasury;
    treasury.redemption_nonce = treasury
        .redemption_nonce
        .checked_add(1)
        .ok_or(StablecoinError::CounterOverflow)?;

    emit!(RedemptionRequested {
        version: EVENT_VERSION,
        mint: ctx.accounts.mint.key(),
        holder: ctx.accounts.holder.key(),
        amount,
        nonce,
        redemption_request: ctx.accounts.redemption_request.key(),
    });
    Ok(())
}
