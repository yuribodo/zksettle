#![allow(deprecated)] // anchor 0.31 macro emits AccountInfo::realloc; fixed in anchor 1.0

pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;

pub const EVENT_VERSION: u8 = 1;

declare_id!("2CdXRSPo6QLfLBJTikmrqmBiWwa1HpuuYJ2Qu6Yy3Liv");

#[program]
pub mod stablecoin {
    use super::*;

    pub fn initialize_mint(ctx: Context<InitializeMint>, decimals: u8) -> Result<()> {
        instructions::initialize_mint_handler(ctx, decimals)
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        instructions::mint_tokens_handler(ctx, amount)
    }

    pub fn request_redemption(ctx: Context<RequestRedemption>, amount: u64) -> Result<()> {
        instructions::request_redemption_handler(ctx, amount)
    }

    pub fn approve_redemption(ctx: Context<ApproveRedemption>) -> Result<()> {
        instructions::approve_redemption_handler(ctx)
    }

    pub fn cancel_redemption(ctx: Context<CancelRedemption>) -> Result<()> {
        instructions::cancel_redemption_handler(ctx)
    }

    pub fn freeze_account(ctx: Context<FreezeOrThaw>) -> Result<()> {
        instructions::freeze_handler(ctx)
    }

    pub fn thaw_account(ctx: Context<FreezeOrThaw>) -> Result<()> {
        instructions::thaw_handler(ctx)
    }

    pub fn propose_admin(ctx: Context<ProposeAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::propose_admin_handler(ctx, new_admin)
    }

    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        instructions::accept_admin_handler(ctx)
    }

    pub fn cancel_pending_admin(ctx: Context<CancelPendingAdmin>) -> Result<()> {
        instructions::cancel_pending_admin_handler(ctx)
    }

    pub fn set_operator(ctx: Context<SetOperator>, new_operator: Pubkey) -> Result<()> {
        instructions::set_operator_handler(ctx, new_operator)
    }

    pub fn update_mint_cap(ctx: Context<UpdateMintCap>, new_cap: u64) -> Result<()> {
        instructions::update_mint_cap_handler(ctx, new_cap)
    }

    pub fn pause(ctx: Context<PauseOrUnpause>) -> Result<()> {
        instructions::pause_handler(ctx)
    }

    pub fn unpause(ctx: Context<PauseOrUnpause>) -> Result<()> {
        instructions::unpause_handler(ctx)
    }
}
