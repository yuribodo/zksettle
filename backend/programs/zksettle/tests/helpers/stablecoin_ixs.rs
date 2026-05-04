use anchor_lang::prelude::Pubkey;
use solana_instruction::Instruction;

pub use stablecoin::test_helpers::{
    approve_redemption_ix, freeze_account_ix, mint_tokens_ix, request_redemption_ix, treasury_pda,
};

pub fn create_stablecoin_mint_with_hook_ixs(
    payer: &Pubkey,
    mint_key: &Pubkey,
    decimals: u8,
) -> Vec<Instruction> {
    let mut ixs = super::instructions::create_hook_mint_base_ixs(payer, mint_key);
    ixs.push(stablecoin::test_helpers::initialize_mint_ix(payer, mint_key, decimals));
    ixs
}

pub fn create_token2022_account_ixs(
    payer: &Pubkey,
    account_key: &Pubkey,
    mint: &Pubkey,
    owner: &Pubkey,
) -> Vec<Instruction> {
    use spl_token_2022::{
        extension::ExtensionType,
        instruction::initialize_account3,
        state::Account as SplAccount,
    };

    let space = ExtensionType::try_calculate_account_len::<SplAccount>(
        &[ExtensionType::TransferHookAccount],
    )
    .unwrap();

    let create_ix = super::instructions::create_token2022_alloc_ix(payer, account_key, space);
    let init_ix = initialize_account3(&spl_token_2022::ID, account_key, mint, owner).unwrap();

    vec![create_ix, init_ix]
}

pub fn transfer_checked_no_hook_ix(
    source: &Pubkey,
    mint: &Pubkey,
    destination: &Pubkey,
    owner: &Pubkey,
    amount: u64,
    decimals: u8,
) -> Instruction {
    spl_token_2022::instruction::transfer_checked(
        &spl_token_2022::ID,
        source,
        mint,
        destination,
        owner,
        &[],
        amount,
        decimals,
    )
    .unwrap()
}
