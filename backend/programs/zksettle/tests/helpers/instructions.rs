use anchor_lang::prelude::Pubkey;
use anchor_lang::{system_program, InstructionData};
use solana_instruction::{AccountMeta, Instruction};
use spl_discriminator::SplDiscriminate;

use zksettle::instruction::{
    CloseHookPayload as ClosePayloadIx, InitExtraAccountMetaList as InitMetaIx,
    RegisterIssuer as RegisterIssuerIx, SetHookPayload as SetPayloadIx,
    UpdateIssuerRoot as UpdateIssuerRootIx,
};
use zksettle::instructions::transfer_hook::{
    ExtraAccountMetaInput, StagedLightArgs, EXTRA_ACCOUNT_META_LIST_SEED, HOOK_PAYLOAD_SEED,
};
use zksettle::state::ISSUER_SEED;

pub const ANCHOR_ERROR_CODE_OFFSET: u32 = 6000;
pub const CONSTRAINT_SEEDS: u32 = 2006;

pub fn issuer_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[ISSUER_SEED, authority.as_ref()], &zksettle::ID).0
}

pub fn hook_payload_pda(owner: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[HOOK_PAYLOAD_SEED, owner.as_ref()], &zksettle::ID)
}

pub fn extra_meta_pda(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[EXTRA_ACCOUNT_META_LIST_SEED, mint.as_ref()],
        &zksettle::ID,
    )
}

pub fn register_ix(authority: &Pubkey, merkle_root: [u8; 32]) -> Instruction {
    register_ix_full(authority, merkle_root, [10u8; 32], [11u8; 32])
}

pub fn register_ix_full(
    authority: &Pubkey,
    merkle_root: [u8; 32],
    sanctions_root: [u8; 32],
    jurisdiction_root: [u8; 32],
) -> Instruction {
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(issuer_pda(authority), false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: RegisterIssuerIx {
            merkle_root,
            sanctions_root,
            jurisdiction_root,
        }
        .data(),
    }
}

pub fn update_ix(authority: &Pubkey, issuer: &Pubkey, merkle_root: [u8; 32]) -> Instruction {
    update_ix_full(authority, issuer, merkle_root, [10u8; 32], [11u8; 32])
}

pub fn update_ix_full(
    authority: &Pubkey,
    issuer: &Pubkey,
    merkle_root: [u8; 32],
    sanctions_root: [u8; 32],
    jurisdiction_root: [u8; 32],
) -> Instruction {
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new(*issuer, false),
        ],
        data: UpdateIssuerRootIx {
            merkle_root,
            sanctions_root,
            jurisdiction_root,
        }
        .data(),
    }
}

#[allow(clippy::too_many_arguments)]
pub fn set_hook_payload_ix(
    owner: &Pubkey,
    issuer_key: &Pubkey,
    proof_and_witness: Vec<u8>,
    nullifier_hash: [u8; 32],
    mint: Pubkey,
    epoch: u64,
    recipient: Pubkey,
    amount: u64,
    light_args: StagedLightArgs,
) -> Instruction {
    let (payload_pda, _) = hook_payload_pda(owner);
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(*owner, true),
            AccountMeta::new_readonly(*issuer_key, false),
            AccountMeta::new(payload_pda, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: SetPayloadIx {
            proof_and_witness,
            nullifier_hash,
            mint,
            epoch,
            recipient,
            amount,
            light_args,
        }
        .data(),
    }
}

pub fn init_extra_meta_ix(
    authority: &Pubkey,
    mint: &Pubkey,
    extras: Vec<ExtraAccountMetaInput>,
) -> Instruction {
    let (meta_pda, _) = extra_meta_pda(mint);
    let issuer = issuer_pda(authority);
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(issuer, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(meta_pda, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: InitMetaIx { extras }.data(),
    }
}

/// Build instructions to create a Token-2022 mint with TransferHook extension
/// pointing to the zksettle program.
pub fn create_token2022_mint_with_hook_ixs(
    payer: &Pubkey,
    mint_key: &Pubkey,
    decimals: u8,
) -> Vec<Instruction> {
    use spl_token_2022::{
        extension::{transfer_hook::instruction::initialize as init_hook, ExtensionType},
        instruction::initialize_mint2,
        state::Mint as SplMint,
    };

    let extensions = &[ExtensionType::TransferHook];
    let space = ExtensionType::try_calculate_account_len::<SplMint>(extensions).unwrap();

    let rent = anchor_lang::solana_program::rent::Rent::default();
    let create_ix = anchor_lang::solana_program::system_instruction::create_account(
        payer,
        mint_key,
        rent.minimum_balance(space),
        space as u64,
        &spl_token_2022::ID,
    );

    let init_hook_ix =
        init_hook(&spl_token_2022::ID, mint_key, Some(*payer), Some(zksettle::ID)).unwrap();

    let init_mint_ix =
        initialize_mint2(&spl_token_2022::ID, mint_key, payer, None, decimals).unwrap();

    vec![create_ix, init_hook_ix, init_mint_ix]
}

/// Build a raw `transfer_hook` (ExecuteHook) instruction.
/// Uses the SPL transfer-hook discriminator `[105, 37, 101, 197, 75, 251, 102, 26]`.
#[allow(clippy::too_many_arguments)]
pub fn execute_hook_ix(
    source_token: &Pubkey,
    mint: &Pubkey,
    destination_token: &Pubkey,
    owner: &Pubkey,
    issuer: &Pubkey,
    registry: &Pubkey,
    bubblegum_program: &Pubkey,
    amount: u64,
) -> Instruction {
    let (meta_pda, _) = extra_meta_pda(mint);
    let (payload_pda, _) = hook_payload_pda(owner);

    let mut data = Vec::with_capacity(16);
    data.extend_from_slice(spl_transfer_hook_interface::instruction::ExecuteInstruction::SPL_DISCRIMINATOR_SLICE);
    data.extend_from_slice(&amount.to_le_bytes());

    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new_readonly(*source_token, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(*destination_token, false),
            AccountMeta::new_readonly(*owner, false),
            AccountMeta::new_readonly(meta_pda, false),
            AccountMeta::new(payload_pda, false),
            AccountMeta::new_readonly(*issuer, false),
            AccountMeta::new_readonly(*registry, false),
            AccountMeta::new_readonly(*bubblegum_program, false),
        ],
        data,
    }
}

pub fn close_hook_payload_ix(authority: &Pubkey) -> Instruction {
    let (payload_pda, _) = hook_payload_pda(authority);
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(payload_pda, false),
        ],
        data: ClosePayloadIx {}.data(),
    }
}

pub fn default_light_args() -> StagedLightArgs {
    StagedLightArgs {
        bubblegum_tail: 0,
        proof_present: false,
        proof_bytes: [0u8; 128],
        address_mt_index: 0,
        address_queue_index: 0,
        address_root_index: 0,
        output_state_tree_index: 0,
    }
}
