use anchor_lang::prelude::Pubkey;
use anchor_lang::InstructionData;
use solana_instruction::{AccountMeta, Instruction};

use crate::state::{
    ESCROW_AUTHORITY_SEED, FREEZE_AUTHORITY_SEED, MINT_AUTHORITY_SEED, REDEMPTION_SEED,
    TREASURY_SEED,
};

pub fn treasury_pda(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[TREASURY_SEED, mint.as_ref()], &crate::ID)
}

pub fn mint_authority_pda(treasury: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[MINT_AUTHORITY_SEED, treasury.as_ref()], &crate::ID)
}

pub fn freeze_authority_pda(treasury: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[FREEZE_AUTHORITY_SEED, treasury.as_ref()], &crate::ID)
}

pub fn escrow_authority_pda(treasury: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[ESCROW_AUTHORITY_SEED, treasury.as_ref()], &crate::ID)
}

pub fn redemption_pda(treasury: &Pubkey, holder: &Pubkey, nonce: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[REDEMPTION_SEED, treasury.as_ref(), holder.as_ref(), &nonce.to_le_bytes()],
        &crate::ID,
    )
}

pub fn initialize_mint_ix(admin: &Pubkey, mint: &Pubkey, decimals: u8) -> Instruction {
    let (treasury, _) = treasury_pda(mint);
    let (mint_authority, _) = mint_authority_pda(&treasury);
    let (freeze_authority, _) = freeze_authority_pda(&treasury);
    let (escrow_authority, _) = escrow_authority_pda(&treasury);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new(*mint, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new_readonly(mint_authority, false),
            AccountMeta::new_readonly(freeze_authority, false),
            AccountMeta::new_readonly(escrow_authority, false),
            AccountMeta::new_readonly(anchor_spl::token_2022::ID, false),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
        ],
        data: crate::instruction::InitializeMint { decimals }.data(),
    }
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
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*operator, true),
            AccountMeta::new(treasury, false),
            AccountMeta::new(*mint, false),
            AccountMeta::new_readonly(mint_authority, false),
            AccountMeta::new(*destination, false),
            AccountMeta::new_readonly(anchor_spl::token_2022::ID, false),
        ],
        data: crate::instruction::MintTokens { amount }.data(),
    }
}

pub fn request_redemption_ix(
    holder: &Pubkey,
    mint: &Pubkey,
    token_account: &Pubkey,
    amount: u64,
    nonce: u64,
) -> Instruction {
    let (treasury, _) = treasury_pda(mint);
    let (escrow_authority, _) = escrow_authority_pda(&treasury);
    let (freeze_authority, _) = freeze_authority_pda(&treasury);
    let (redemption_request, _) = redemption_pda(&treasury, holder, nonce);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new(*holder, true),
            AccountMeta::new(treasury, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(*token_account, false),
            AccountMeta::new(redemption_request, false),
            AccountMeta::new_readonly(escrow_authority, false),
            AccountMeta::new_readonly(freeze_authority, false),
            AccountMeta::new_readonly(anchor_spl::token_2022::ID, false),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
        ],
        data: crate::instruction::RequestRedemption { amount }.data(),
    }
}

pub fn approve_redemption_ix(
    operator: &Pubkey,
    holder: &Pubkey,
    mint: &Pubkey,
    token_account: &Pubkey,
    nonce: u64,
) -> Instruction {
    let (treasury, _) = treasury_pda(mint);
    let (escrow_authority, _) = escrow_authority_pda(&treasury);
    let (freeze_authority, _) = freeze_authority_pda(&treasury);
    let (redemption_request, _) = redemption_pda(&treasury, holder, nonce);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*operator, true),
            AccountMeta::new(*holder, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new(*mint, false),
            AccountMeta::new(redemption_request, false),
            AccountMeta::new(*token_account, false),
            AccountMeta::new_readonly(escrow_authority, false),
            AccountMeta::new_readonly(freeze_authority, false),
            AccountMeta::new_readonly(anchor_spl::token_2022::ID, false),
        ],
        data: crate::instruction::ApproveRedemption {}.data(),
    }
}

pub fn cancel_redemption_ix(
    canceller: &Pubkey,
    holder: &Pubkey,
    mint: &Pubkey,
    token_account: &Pubkey,
    nonce: u64,
) -> Instruction {
    let (treasury, _) = treasury_pda(mint);
    let (escrow_authority, _) = escrow_authority_pda(&treasury);
    let (freeze_authority, _) = freeze_authority_pda(&treasury);
    let (redemption_request, _) = redemption_pda(&treasury, holder, nonce);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*canceller, true),
            AccountMeta::new(*holder, false),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(redemption_request, false),
            AccountMeta::new(*token_account, false),
            AccountMeta::new_readonly(escrow_authority, false),
            AccountMeta::new_readonly(freeze_authority, false),
            AccountMeta::new_readonly(anchor_spl::token_2022::ID, false),
        ],
        data: crate::instruction::CancelRedemption {}.data(),
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
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*admin, true),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(freeze_authority, false),
            AccountMeta::new(*target_account, false),
            AccountMeta::new_readonly(anchor_spl::token_2022::ID, false),
        ],
        data: crate::instruction::FreezeAccount {}.data(),
    }
}

pub fn thaw_account_ix(
    admin: &Pubkey,
    mint: &Pubkey,
    target_account: &Pubkey,
) -> Instruction {
    let (treasury, _) = treasury_pda(mint);
    let (freeze_authority, _) = freeze_authority_pda(&treasury);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*admin, true),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(freeze_authority, false),
            AccountMeta::new(*target_account, false),
            AccountMeta::new_readonly(anchor_spl::token_2022::ID, false),
        ],
        data: crate::instruction::ThawAccount {}.data(),
    }
}

pub fn pause_ix(admin: &Pubkey, mint: &Pubkey) -> Instruction {
    let (treasury, _) = treasury_pda(mint);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*admin, true),
            AccountMeta::new(treasury, false),
        ],
        data: crate::instruction::Pause {}.data(),
    }
}

pub fn unpause_ix(admin: &Pubkey, mint: &Pubkey) -> Instruction {
    let (treasury, _) = treasury_pda(mint);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*admin, true),
            AccountMeta::new(treasury, false),
        ],
        data: crate::instruction::Unpause {}.data(),
    }
}

pub fn propose_admin_ix(admin: &Pubkey, mint: &Pubkey, new_admin: Pubkey) -> Instruction {
    let (treasury, _) = treasury_pda(mint);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new(treasury, false),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
        ],
        data: crate::instruction::ProposeAdmin { new_admin }.data(),
    }
}

pub fn accept_admin_ix(new_admin: &Pubkey, mint: &Pubkey) -> Instruction {
    let (treasury, _) = treasury_pda(mint);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*new_admin, true),
            AccountMeta::new(treasury, false),
        ],
        data: crate::instruction::AcceptAdmin {}.data(),
    }
}

pub fn cancel_pending_admin_ix(admin: &Pubkey, mint: &Pubkey) -> Instruction {
    let (treasury, _) = treasury_pda(mint);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*admin, true),
            AccountMeta::new(treasury, false),
        ],
        data: crate::instruction::CancelPendingAdmin {}.data(),
    }
}

pub fn set_operator_ix(admin: &Pubkey, mint: &Pubkey, new_operator: Pubkey) -> Instruction {
    let (treasury, _) = treasury_pda(mint);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*admin, true),
            AccountMeta::new(treasury, false),
        ],
        data: crate::instruction::SetOperator { new_operator }.data(),
    }
}

pub fn update_mint_cap_ix(admin: &Pubkey, mint: &Pubkey, new_cap: u64) -> Instruction {
    let (treasury, _) = treasury_pda(mint);

    Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(*admin, true),
            AccountMeta::new(treasury, false),
        ],
        data: crate::instruction::UpdateMintCap { new_cap }.data(),
    }
}
