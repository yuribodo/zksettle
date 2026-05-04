use anchor_lang::prelude::Pubkey;
use anchor_lang::{system_program, InstructionData};
use solana_instruction::{AccountMeta, Instruction};

use stablecoin::state::{FREEZE_AUTHORITY_SEED, MINT_AUTHORITY_SEED, TREASURY_SEED};

pub fn treasury_pda(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[TREASURY_SEED, mint.as_ref()], &stablecoin::ID)
}

pub fn mint_authority_pda(treasury: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[MINT_AUTHORITY_SEED, treasury.as_ref()], &stablecoin::ID)
}

pub fn freeze_authority_pda(treasury: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[FREEZE_AUTHORITY_SEED, treasury.as_ref()], &stablecoin::ID)
}

pub fn create_stablecoin_mint_with_hook_ixs(
    payer: &Pubkey,
    mint_key: &Pubkey,
    decimals: u8,
) -> Vec<Instruction> {
    let mut ixs = super::instructions::create_hook_mint_base_ixs(payer, mint_key);

    let (treasury, _) = treasury_pda(mint_key);
    let (mint_authority, _) = mint_authority_pda(&treasury);
    let (freeze_authority, _) = freeze_authority_pda(&treasury);

    ixs.push(Instruction {
        program_id: stablecoin::ID,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new(*mint_key, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new_readonly(mint_authority, false),
            AccountMeta::new_readonly(freeze_authority, false),
            AccountMeta::new_readonly(spl_token_2022::ID, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: stablecoin::instruction::InitializeMint { decimals }.data(),
    });

    ixs
}

pub fn mint_tokens_ix(
    operator: &Pubkey,
    mint: &Pubkey,
    destination: &Pubkey,
    amount: u64,
) -> Instruction {
    let (treasury, _) = treasury_pda(mint);
    let (mint_authority, _) = mint_authority_pda(&treasury);

    Instruction {
        program_id: stablecoin::ID,
        accounts: vec![
            AccountMeta::new_readonly(*operator, true),
            AccountMeta::new(treasury, false),
            AccountMeta::new(*mint, false),
            AccountMeta::new_readonly(mint_authority, false),
            AccountMeta::new(*destination, false),
            AccountMeta::new_readonly(spl_token_2022::ID, false),
        ],
        data: stablecoin::instruction::MintTokens { amount }.data(),
    }
}

pub fn burn_tokens_ix(
    holder: &Pubkey,
    mint: &Pubkey,
    token_account: &Pubkey,
    amount: u64,
) -> Instruction {
    let (treasury, _) = treasury_pda(mint);

    Instruction {
        program_id: stablecoin::ID,
        accounts: vec![
            AccountMeta::new_readonly(*holder, true),
            AccountMeta::new(treasury, false),
            AccountMeta::new(*mint, false),
            AccountMeta::new(*token_account, false),
            AccountMeta::new_readonly(spl_token_2022::ID, false),
        ],
        data: stablecoin::instruction::BurnTokens { amount }.data(),
    }
}

pub fn freeze_account_ix(
    admin: &Pubkey,
    mint: &Pubkey,
    target_account: &Pubkey,
) -> Instruction {
    let (treasury, _) = treasury_pda(mint);
    let (freeze_authority, _) = freeze_authority_pda(&treasury);

    Instruction {
        program_id: stablecoin::ID,
        accounts: vec![
            AccountMeta::new_readonly(*admin, true),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(freeze_authority, false),
            AccountMeta::new(*target_account, false),
            AccountMeta::new_readonly(spl_token_2022::ID, false),
        ],
        data: stablecoin::instruction::FreezeAccount {}.data(),
    }
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

    let extensions = &[ExtensionType::TransferHookAccount];
    let space = ExtensionType::try_calculate_account_len::<SplAccount>(extensions).unwrap();

    let rent = anchor_lang::solana_program::rent::Rent::default();
    let create_ix = anchor_lang::solana_program::system_instruction::create_account(
        payer,
        account_key,
        rent.minimum_balance(space),
        space as u64,
        &spl_token_2022::ID,
    );

    let init_ix =
        initialize_account3(&spl_token_2022::ID, account_key, mint, owner).unwrap();

    vec![create_ix, init_ix]
}

pub fn transfer_checked_ix(
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
