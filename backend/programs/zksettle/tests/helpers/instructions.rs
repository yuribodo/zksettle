use anchor_lang::prelude::Pubkey;
use anchor_lang::{system_program, InstructionData};
use solana_instruction::{AccountMeta, Instruction};

use zksettle::instruction::{
    InitExtraAccountMetaList as InitMetaIx, RegisterIssuer as RegisterIssuerIx,
    SetHookPayload as SetPayloadIx, UpdateIssuerRoot as UpdateIssuerRootIx,
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
            AccountMeta::new(payload_pda, false),
            AccountMeta::new_readonly(*issuer_key, false),
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
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(meta_pda, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: InitMetaIx { extras }.data(),
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
