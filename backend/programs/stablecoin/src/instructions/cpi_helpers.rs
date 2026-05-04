use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint as MintAccount, Token2022, TokenAccount};

use crate::state::FREEZE_AUTHORITY_SEED;

pub fn thaw_token_account<'info>(
    token_account: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, MintAccount>,
    freeze_authority: &UncheckedAccount<'info>,
    token_program: &Program<'info, Token2022>,
    treasury_key: &Pubkey,
    freeze_authority_bump: u8,
) -> Result<()> {
    let bump = [freeze_authority_bump];
    let seeds: &[&[u8]] = &[FREEZE_AUTHORITY_SEED, treasury_key.as_ref(), &bump];
    let cpi_accounts = token_2022::ThawAccount {
        account: token_account.to_account_info(),
        mint: mint.to_account_info(),
        authority: freeze_authority.to_account_info(),
    };
    token_2022::thaw_account(CpiContext::new_with_signer(
        token_program.to_account_info(),
        cpi_accounts,
        &[seeds],
    ))
}
