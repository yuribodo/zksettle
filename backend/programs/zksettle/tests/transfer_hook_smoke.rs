#![cfg(feature = "light-tests")]
//! Smoke tests for the Token-2022 transfer-hook path.
//!
//! Tests here exercise `set_hook_payload` and `init_extra_account_meta_list`
//! which don't need gnark fixtures. The full settle path (`transfer_hook` /
//! `settle_hook`) stays `#[ignore]` until gnark proof + Token-2022 mint
//! fixtures exist (see ADR-006 follow-up).
//!
//! Run with:
//!
//! ```bash
//! cargo test --features light-tests --test transfer_hook_smoke -- --nocapture
//! ```

use anchor_lang::prelude::Pubkey;
use anchor_lang::{system_program, InstructionData};
use light_program_test::{utils::assert::assert_rpc_error, LightProgramTest, ProgramTestConfig, Rpc};
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_signer::Signer;

use zksettle::error::ZkSettleError;
use zksettle::instruction::{
    InitExtraAccountMetaList as InitMetaIx, RegisterIssuer as RegisterIssuerIx,
    SetHookPayload as SetPayloadIx,
};
use zksettle::instructions::transfer_hook::{
    ExtraAccountMetaInput, StagedLightArgs, EXTRA_ACCOUNT_META_LIST_SEED, HOOK_PAYLOAD_SEED,
};
use zksettle::state::ISSUER_SEED;

const ANCHOR_ERROR_CODE_OFFSET: u32 = 6000;

fn issuer_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[ISSUER_SEED, authority.as_ref()], &zksettle::ID).0
}

fn hook_payload_pda(owner: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[HOOK_PAYLOAD_SEED, owner.as_ref()], &zksettle::ID)
}

fn extra_meta_pda(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[EXTRA_ACCOUNT_META_LIST_SEED, mint.as_ref()],
        &zksettle::ID,
    )
}

fn register_ix(authority: &Pubkey, merkle_root: [u8; 32]) -> Instruction {
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(issuer_pda(authority), false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: RegisterIssuerIx { merkle_root }.data(),
    }
}

fn set_hook_payload_ix(
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

fn init_extra_meta_ix(
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

fn default_light_args() -> StagedLightArgs {
    StagedLightArgs {
        proof_present: false,
        proof_bytes: [0u8; 128],
        address_mt_index: 0,
        address_queue_index: 0,
        address_root_index: 0,
        output_state_tree_index: 0,
    }
}

async fn boot_harness() -> LightProgramTest {
    let config = ProgramTestConfig::new_v2(false, Some(vec![("zksettle", zksettle::ID)]));
    LightProgramTest::new(config).await.expect("boot light harness")
}

async fn funded_authority(rpc: &mut LightProgramTest, lamports: u64) -> Keypair {
    let kp = Keypair::new();
    rpc.airdrop_lamports(&kp.pubkey(), lamports).await.expect("airdrop");
    kp
}

#[tokio::test]
async fn set_hook_payload_stores_fields() {
    let mut rpc = boot_harness().await;
    let authority = funded_authority(&mut rpc, 10_000_000_000).await;

    rpc.create_and_send_transaction(
        &[register_ix(&authority.pubkey(), [1u8; 32])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("register should succeed");

    let issuer_key = issuer_pda(&authority.pubkey());
    let mint = Pubkey::new_unique();
    let recipient = Pubkey::new_unique();
    let nullifier = {
        let mut n = [0u8; 32];
        n[0] = 1;
        n
    };

    rpc.create_and_send_transaction(
        &[set_hook_payload_ix(
            &authority.pubkey(),
            &issuer_key,
            vec![0xaa; 256],
            nullifier,
            mint,
            10,
            recipient,
            500,
            default_light_args(),
        )],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("set_hook_payload should succeed");

    let (payload_key, _) = hook_payload_pda(&authority.pubkey());
    let payload: zksettle::instructions::transfer_hook::HookPayload = rpc
        .get_anchor_account(&payload_key)
        .await
        .expect("fetch")
        .expect("payload must exist");

    assert_eq!(payload.issuer, issuer_key);
    assert_eq!(payload.nullifier_hash, nullifier);
    assert_eq!(payload.mint, mint);
    assert_eq!(payload.recipient, recipient);
    assert_eq!(payload.amount, 500);
    assert_eq!(payload.epoch, 10);
    assert_eq!(payload.proof_and_witness.len(), 256);
}

#[tokio::test]
async fn set_hook_payload_rejects_zero_nullifier() {
    let mut rpc = boot_harness().await;
    let authority = funded_authority(&mut rpc, 10_000_000_000).await;

    rpc.create_and_send_transaction(
        &[register_ix(&authority.pubkey(), [1u8; 32])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("register");

    let issuer_key = issuer_pda(&authority.pubkey());
    let result = rpc
        .create_and_send_transaction(
            &[set_hook_payload_ix(
                &authority.pubkey(),
                &issuer_key,
                vec![0xaa; 256],
                [0u8; 32],
                Pubkey::new_unique(),
                10,
                Pubkey::new_unique(),
                500,
                default_light_args(),
            )],
            &authority.pubkey(),
            &[&authority],
        )
        .await;

    assert_rpc_error(
        result,
        0,
        ANCHOR_ERROR_CODE_OFFSET + ZkSettleError::ZeroNullifier as u32,
    )
    .expect("expected ZeroNullifier");
}

#[tokio::test]
async fn set_hook_payload_rejects_zero_amount() {
    let mut rpc = boot_harness().await;
    let authority = funded_authority(&mut rpc, 10_000_000_000).await;

    rpc.create_and_send_transaction(
        &[register_ix(&authority.pubkey(), [1u8; 32])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("register");

    let issuer_key = issuer_pda(&authority.pubkey());
    let mut nullifier = [0u8; 32];
    nullifier[0] = 1;

    let result = rpc
        .create_and_send_transaction(
            &[set_hook_payload_ix(
                &authority.pubkey(),
                &issuer_key,
                vec![0xaa; 256],
                nullifier,
                Pubkey::new_unique(),
                10,
                Pubkey::new_unique(),
                0,
                default_light_args(),
            )],
            &authority.pubkey(),
            &[&authority],
        )
        .await;

    assert_rpc_error(
        result,
        0,
        ANCHOR_ERROR_CODE_OFFSET + ZkSettleError::InvalidTransferAmount as u32,
    )
    .expect("expected InvalidTransferAmount");
}

#[tokio::test]
async fn init_extra_account_meta_list_succeeds() {
    let mut rpc = boot_harness().await;
    let authority = funded_authority(&mut rpc, 10_000_000_000).await;
    let mint = Pubkey::new_unique();

    let meta = ExtraAccountMetaInput {
        discriminator: 0,
        address_config: authority.pubkey().to_bytes(),
        is_signer: false,
        is_writable: true,
    };

    rpc.create_and_send_transaction(
        &[init_extra_meta_ix(&authority.pubkey(), &mint, vec![meta])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("init_extra_account_meta_list should succeed");

    let (meta_pda, _) = extra_meta_pda(&mint);
    let info = rpc
        .get_account(meta_pda)
        .await
        .expect("fetch meta account")
        .expect("meta account must exist");
    assert!(info.data.len() > 0, "TLV data should be non-empty");
}

#[tokio::test]
#[ignore = "requires gnark fixture + Token-2022 mint with hook configured"]
async fn transfer_hook_settles_and_blocks_replay() {
    let _rpc = boot_harness().await;
    // TODO(ADR-006 follow-up):
    // - build Token-2022 mint with TransferHook extension pointing at zksettle
    // - load gnark proof + witness fixture for (mint, epoch, recipient, amount)
    // - run set_hook_payload then a Token-2022 transfer that triggers the hook
    // - assert Light attestation account + ProofSettled event (9 fields)
    // - replay same payload, assert address-collision error from Light CPI
}
