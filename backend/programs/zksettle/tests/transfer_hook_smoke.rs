#![cfg(all(feature = "light-tests", unix))]
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
//!
//! **Windows:** `light-program-test` is not linked on non-Unix targets (dev-deps
//! are Unix-only). Run these tests under WSL or Linux CI.

mod helpers;

use anchor_lang::prelude::Pubkey;
use light_program_test::{utils::assert::assert_rpc_error, Rpc};
use solana_signer::Signer;

use zksettle::error::ZkSettleError;
use zksettle::instructions::transfer_hook::MAX_HOOK_PROOF_BYTES;

use helpers::{
    boot_harness, close_hook_payload_ix, close_hook_payload_ix_with_pda, default_light_args,
    execute_hook_ix, extra_meta_pda, hook_payload_pda, initialized_tree, mint_with_extra_meta,
    nonzero_nullifier, registered_issuer, set_hook_payload_ix, settle_pda_keys,
    ANCHOR_ERROR_CODE_OFFSET, CONSTRAINT_SEEDS,
};

async fn stage_default_payload(
    rpc: &mut light_program_test::LightProgramTest,
    authority: &solana_keypair::Keypair,
    issuer_key: &Pubkey,
    proof_byte: u8,
    proof_len: usize,
    amount: u64,
) {
    rpc.create_and_send_transaction(
        &[set_hook_payload_ix(
            &authority.pubkey(),
            issuer_key,
            vec![proof_byte; proof_len],
            nonzero_nullifier(),
            Pubkey::new_unique(),
            10,
            Pubkey::new_unique(),
            amount,
            default_light_args(),
        )],
        &authority.pubkey(),
        &[authority],
    )
    .await
    .expect("stage_default_payload");
}

#[tokio::test]
async fn set_hook_payload_stores_fields() {
    let mut rpc = boot_harness().await;
    let (authority, issuer_key) = registered_issuer(&mut rpc).await;

    let mint = Pubkey::new_unique();
    let recipient = Pubkey::new_unique();
    let nullifier = nonzero_nullifier();

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
    let (authority, issuer_key) = registered_issuer(&mut rpc).await;

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
    let (authority, issuer_key) = registered_issuer(&mut rpc).await;

    let result = rpc
        .create_and_send_transaction(
            &[set_hook_payload_ix(
                &authority.pubkey(),
                &issuer_key,
                vec![0xaa; 256],
                nonzero_nullifier(),
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
    let (authority, _) = registered_issuer(&mut rpc).await;

    let mint_kp = mint_with_extra_meta(&mut rpc, &authority).await;

    let (meta_pda, _) = extra_meta_pda(&mint_kp.pubkey());
    let info = rpc
        .get_account(meta_pda)
        .await
        .expect("fetch meta account")
        .expect("meta account must exist");
    assert!(info.data.len() > 0, "TLV data should be non-empty");
}

#[tokio::test]
async fn set_hook_payload_rejects_oversized_proof() {
    let mut rpc = boot_harness().await;
    let (authority, issuer_key) = registered_issuer(&mut rpc).await;

    let result = rpc
        .create_and_send_transaction(
            &[set_hook_payload_ix(
                &authority.pubkey(),
                &issuer_key,
                vec![0xaa; MAX_HOOK_PROOF_BYTES + 1],
                nonzero_nullifier(),
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
        ANCHOR_ERROR_CODE_OFFSET + ZkSettleError::HookPayloadInvalid as u32,
    )
    .expect("expected HookPayloadInvalid for oversized proof");
}

#[tokio::test]
async fn execute_hook_rejects_missing_payload() {
    let mut rpc = boot_harness().await;
    let (authority, issuer_key) = registered_issuer(&mut rpc).await;

    let fake_mint = Pubkey::new_unique();
    let fake_source = Pubkey::new_unique();
    let fake_dest = Pubkey::new_unique();
    let registry = Pubkey::new_unique();
    let bubblegum = Pubkey::new_unique();

    let result = rpc
        .create_and_send_transaction(
            &[execute_hook_ix(
                &fake_source,
                &fake_mint,
                &fake_dest,
                &authority.pubkey(),
                &issuer_key,
                &registry,
                &bubblegum,
                500,
            )],
            &authority.pubkey(),
            &[&authority],
        )
        .await;

    assert_rpc_error(
        result,
        0,
        anchor_lang::error::ErrorCode::AccountNotInitialized as u32,
    )
    .expect("expected AccountNotInitialized for missing payload");
}

#[tokio::test]
async fn close_hook_payload_reclaims_rent() {
    let mut rpc = boot_harness().await;
    let (authority, issuer_key) = registered_issuer(&mut rpc).await;

    stage_default_payload(&mut rpc, &authority, &issuer_key, 0xaa, 256, 500).await;

    let (payload_key, _) = hook_payload_pda(&authority.pubkey());
    let pre_balance = rpc
        .get_account(authority.pubkey())
        .await
        .expect("fetch")
        .expect("authority exists")
        .lamports;

    rpc.create_and_send_transaction(
        &[close_hook_payload_ix(&authority.pubkey())],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("close_hook_payload should succeed");

    let account = rpc.get_account(payload_key).await.expect("fetch");
    assert!(account.is_none(), "PDA should be closed");

    let post_balance = rpc
        .get_account(authority.pubkey())
        .await
        .expect("fetch")
        .expect("authority exists")
        .lamports;
    assert!(post_balance > pre_balance, "rent should be returned");
}

#[tokio::test]
async fn close_hook_payload_then_restage() {
    let mut rpc = boot_harness().await;
    let (authority, issuer_key) = registered_issuer(&mut rpc).await;

    stage_default_payload(&mut rpc, &authority, &issuer_key, 0xbb, 128, 1000).await;

    rpc.create_and_send_transaction(
        &[close_hook_payload_ix(&authority.pubkey())],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("close");

    stage_default_payload(&mut rpc, &authority, &issuer_key, 0xcc, 128, 2000).await;

    let (payload_key, _) = hook_payload_pda(&authority.pubkey());
    let payload: zksettle::instructions::transfer_hook::HookPayload = rpc
        .get_anchor_account(&payload_key)
        .await
        .expect("fetch")
        .expect("payload must exist after re-stage");
    assert_eq!(payload.amount, 2000);
}

#[tokio::test]
async fn close_hook_payload_wrong_authority_fails() {
    let mut rpc = boot_harness().await;
    let (authority, issuer_key) = registered_issuer(&mut rpc).await;

    stage_default_payload(&mut rpc, &authority, &issuer_key, 0xaa, 256, 500).await;

    let wrong = helpers::funded_authority(&mut rpc, 10_000_000_000).await;

    // Attacker signs but targets the legit PDA — seed mismatch yields ConstraintSeeds.
    let (legit_pda, _) = hook_payload_pda(&authority.pubkey());
    let result = rpc
        .create_and_send_transaction(
            &[close_hook_payload_ix_with_pda(&wrong.pubkey(), &legit_pda)],
            &wrong.pubkey(),
            &[&wrong],
        )
        .await;

    assert_rpc_error(result, 0, CONSTRAINT_SEEDS).expect("expected ConstraintSeeds");
}

#[tokio::test]
async fn close_hook_payload_nonexistent_fails() {
    let mut rpc = boot_harness().await;
    let (authority, _) = registered_issuer(&mut rpc).await;

    let result = rpc
        .create_and_send_transaction(
            &[close_hook_payload_ix(&authority.pubkey())],
            &authority.pubkey(),
            &[&authority],
        )
        .await;

    assert_rpc_error(
        result,
        0,
        anchor_lang::error::ErrorCode::AccountNotInitialized as u32,
    )
    .expect("expected AccountNotInitialized");
}

#[tokio::test]
async fn transfer_hook_wiring_up_to_gnark_boundary() {
    let mut rpc = boot_harness().await;
    let (authority, issuer_key, merkle_tree_kp) = initialized_tree(&mut rpc).await;

    let mint_kp = mint_with_extra_meta(&mut rpc, &authority).await;

    let recipient = Pubkey::new_unique();
    rpc.create_and_send_transaction(
        &[set_hook_payload_ix(
            &authority.pubkey(),
            &issuer_key,
            vec![0xaa; 256],
            nonzero_nullifier(),
            mint_kp.pubkey(),
            10,
            recipient,
            500,
            default_light_args(),
        )],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("set_hook_payload");

    let (registry_key, tree_creator_key, tree_config_key) =
        settle_pda_keys(&merkle_tree_kp.pubkey());

    let result = rpc
        .create_and_send_transaction(
            &[helpers::settle_hook_ix(
                &authority.pubkey(),
                &mint_kp.pubkey(),
                &recipient,
                &issuer_key,
                &registry_key,
                &merkle_tree_kp.pubkey(),
                &tree_config_key,
                &tree_creator_key,
                500,
            )],
            &authority.pubkey(),
            &[&authority],
        )
        .await;

    assert_rpc_error(
        result,
        0,
        ANCHOR_ERROR_CODE_OFFSET + zksettle::error::ZkSettleError::MalformedProof as u32,
    )
    .expect("expected MalformedProof at gnark verification boundary");
}

#[tokio::test]
#[ignore = "un-ignore once gnark fixture exists at tests/fixtures/proof_and_witness.bin"]
async fn transfer_hook_full_e2e_with_gnark_proof() {
    use solana_keypair::Keypair;
    use solana_signer::Signer;

    let fixture_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/proof_and_witness.bin");
    let proof_and_witness = std::fs::read(&fixture_path).expect(
        "fixture not found — generate with: just circuit-fixture",
    );
    assert!(proof_and_witness.len() > 620, "fixture too short to contain proof + 11-input witness");

    let mut rpc = boot_harness().await;

    // Roots must match the circuit's Prover.toml values.
    // TODO: parse from circuits/Prover.toml when fixture generation is automated.
    let merkle_root = [1u8; 32];
    let sanctions_root = [10u8; 32];
    let jurisdiction_root = [11u8; 32];

    let authority = helpers::funded_authority(&mut rpc, 10_000_000_000).await;

    rpc.create_and_send_transaction(
        &[helpers::register_ix_full(
            &authority.pubkey(),
            merkle_root,
            sanctions_root,
            jurisdiction_root,
        )],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("register_issuer");

    let issuer_key = helpers::issuer_pda(&authority.pubkey());

    // init_attestation_tree
    let merkle_tree_kp = Keypair::new();
    rpc.create_and_send_transaction(
        &[helpers::init_attestation_tree_ix(
            &authority.pubkey(),
            &merkle_tree_kp.pubkey(),
        )],
        &authority.pubkey(),
        &[&authority, &merkle_tree_kp],
    )
    .await
    .expect("init_attestation_tree");

    let mint_kp = mint_with_extra_meta(&mut rpc, &authority).await;

    // Fixture inputs — must match circuits/Prover.toml
    let nullifier = nonzero_nullifier();
    let recipient = Pubkey::new_unique();
    let amount: u64 = 500;
    // TODO: derive from fixture's Prover.toml once automated
    let epoch: u64 = 10;

    // set_hook_payload with real proof
    rpc.create_and_send_transaction(
        &[set_hook_payload_ix(
            &authority.pubkey(),
            &issuer_key,
            proof_and_witness.clone(),
            nullifier,
            mint_kp.pubkey(),
            epoch,
            recipient,
            amount,
            default_light_args(),
        )],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("set_hook_payload with real proof");

    let (registry_key, tree_creator_key, tree_config_key) =
        settle_pda_keys(&merkle_tree_kp.pubkey());

    let result = rpc
        .create_and_send_transaction(
            &[helpers::settle_hook_ix(
                &authority.pubkey(),
                &mint_kp.pubkey(),
                &recipient,
                &issuer_key,
                &registry_key,
                &merkle_tree_kp.pubkey(),
                &tree_config_key,
                &tree_creator_key,
                amount,
            )],
            &authority.pubkey(),
            &[&authority],
        )
        .await;

    result.expect("settle_hook should succeed with valid gnark proof");

    // Replay same nullifier → should fail with Light address collision
    rpc.create_and_send_transaction(
        &[set_hook_payload_ix(
            &authority.pubkey(),
            &issuer_key,
            proof_and_witness,
            nullifier,
            mint_kp.pubkey(),
            epoch,
            recipient,
            amount,
            default_light_args(),
        )],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("re-stage same payload");

    let replay = rpc
        .create_and_send_transaction(
            &[helpers::settle_hook_ix(
                &authority.pubkey(),
                &mint_kp.pubkey(),
                &recipient,
                &issuer_key,
                &registry_key,
                &merkle_tree_kp.pubkey(),
                &tree_config_key,
                &tree_creator_key,
                amount,
            )],
            &authority.pubkey(),
            &[&authority],
        )
        .await;

    assert!(
        replay.is_err(),
        "replay with same nullifier should fail (Light address collision)"
    );
}
