#![allow(deprecated)] // anchor 0.31 macro emits AccountInfo::realloc; fixed in anchor 1.0

pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;

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

    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn_tokens_handler(ctx, amount)
    }

    pub fn freeze_account(ctx: Context<FreezeOrThaw>) -> Result<()> {
        instructions::freeze_handler(ctx)
    }

    pub fn thaw_account(ctx: Context<FreezeOrThaw>) -> Result<()> {
        instructions::thaw_handler(ctx)
    }

    pub fn transfer_authority(
        ctx: Context<TransferAuthority>,
        new_admin: Option<Pubkey>,
        new_operator: Option<Pubkey>,
    ) -> Result<()> {
        instructions::transfer_authority_handler(ctx, new_admin, new_operator)
    }
}
