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
use zksettle::instructions::transfer_hook::{ExtraAccountMetaInput, MAX_HOOK_PROOF_BYTES};

use helpers::{
    boot_harness, close_hook_payload_ix, close_hook_payload_ix_with_pda,
    create_token2022_mint_with_hook_ixs, default_light_args, execute_hook_ix, extra_meta_pda,
    hook_payload_pda, init_extra_meta_ix, nonzero_nullifier, registered_issuer,
    set_hook_payload_ix, ANCHOR_ERROR_CODE_OFFSET, CONSTRAINT_SEEDS,
};

async fn stage_default_payload(
    rpc: &mut light_program_test::ProgramTestRpc,
    authority: &impl Signer,
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
    use solana_keypair::Keypair;

    let mut rpc = boot_harness().await;
    let (authority, _) = registered_issuer(&mut rpc).await;

    let mint_kp = Keypair::new();
    let mint_ixs = create_token2022_mint_with_hook_ixs(&authority.pubkey(), &mint_kp.pubkey(), 6);
    rpc.create_and_send_transaction(&mint_ixs, &authority.pubkey(), &[&authority, &mint_kp])
        .await
        .expect("create Token-2022 mint should succeed");

    let meta = ExtraAccountMetaInput {
        discriminator: 0,
        address_config: authority.pubkey().to_bytes(),
        is_signer: false,
        is_writable: true,
    };

    rpc.create_and_send_transaction(
        &[init_extra_meta_ix(
            &authority.pubkey(),
            &mint_kp.pubkey(),
            vec![meta],
        )],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("init_extra_account_meta_list should succeed");

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
#[ignore = "requires gnark fixture + bubblegum tree + Token-2022 mint infrastructure"]
async fn transfer_hook_settles_and_blocks_replay() {
    let _rpc = boot_harness().await;
    // Blocked on:
    //   1. Bubblegum tree registry + merkle tree init (init_attestation_tree)
    //   2. Token-2022 mint with TransferHook extension (create_token2022_mint_with_hook_ixs helper exists)
    //   3. gnark proof fixture for (mint, epoch, recipient, amount)
    //
    // Partial test plan (once bubblegum infra lands):
    //   - register_issuer, init_attestation_tree, create Token-2022 mint
    //   - set_hook_payload with dummy proof
    //   - call settle_hook → expect MalformedProof from verify_bundle
    //   - proves full account wiring up to the gnark boundary
    //
    // Full test:
    //   - load valid gnark proof fixture
    //   - Token-2022 transferChecked triggers hook → asserts Light attestation + ProofSettled event
    //   - replay same payload → assert address-collision from Light CPI
}
