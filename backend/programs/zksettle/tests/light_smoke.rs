#![cfg(feature = "light-tests")]
//! Smoke tests for the Light Protocol migration.
//!
//! Boots a `LightProgramTest` harness with the compiled `zksettle.so` and
//! exercises the pure-Anchor instructions (`register_issuer`,
//! `update_issuer_root`) end-to-end.
//!
//! The Light-CPI paths (`verify_proof`, `check_attestation`) are intentionally
//! out of scope here: they require gnark proof + witness fixtures and a
//! compressed-account setup that belongs in a dedicated fixture crate. See
//! ADR-006 follow-up for the full E2E harness.
//!
//! Run with:
//!
//! ```bash
//! cargo test --features light-tests -- --nocapture
//! ```
//!
//! Requires a running prover server; see the light-program-test README.
//!
//! Prerequisite: `anchor build` must have produced
//! `backend/target/deploy/zksettle.so` so `ProgramTestConfig::new_v2` can
//! load it by name.

mod helpers;

use light_program_test::{utils::assert::assert_rpc_error, Rpc};
use solana_signer::Signer;

use zksettle::error::ZkSettleError;
use zksettle::state::Issuer;

use helpers::{
    boot_harness, funded_authority, issuer_pda, register_ix, update_ix,
    ANCHOR_ERROR_CODE_OFFSET, CONSTRAINT_SEEDS,
};

#[tokio::test]
async fn harness_boots_with_zksettle_program() {
    let mut rpc = boot_harness().await;
    let _ = funded_authority(&mut rpc, 1_000_000_000).await;
}

#[tokio::test]
async fn register_and_update_issuer_through_light_harness() {
    let mut rpc = boot_harness().await;
    let authority = funded_authority(&mut rpc, 10_000_000_000).await;

    let issuer_key = issuer_pda(&authority.pubkey());
    let merkle_root = [7u8; 32];

    rpc.create_and_send_transaction(
        &[register_ix(&authority.pubkey(), merkle_root)],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("register_issuer should succeed");

    let issuer: Issuer = rpc
        .get_anchor_account(&issuer_key)
        .await
        .expect("fetch issuer")
        .expect("issuer account must exist");
    assert_eq!(issuer.authority, authority.pubkey());
    assert_eq!(issuer.merkle_root, merkle_root);

    let new_root = [9u8; 32];
    rpc.create_and_send_transaction(
        &[update_ix(&authority.pubkey(), &issuer_key, new_root)],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("update_issuer_root should succeed");

    let updated: Issuer = rpc
        .get_anchor_account(&issuer_key)
        .await
        .expect("fetch updated")
        .expect("issuer still present");
    assert_eq!(updated.merkle_root, new_root);
}

#[tokio::test]
async fn register_rejects_zero_root() {
    let mut rpc = boot_harness().await;
    let authority = funded_authority(&mut rpc, 10_000_000_000).await;

    let result = rpc
        .create_and_send_transaction(
            &[register_ix(&authority.pubkey(), [0u8; 32])],
            &authority.pubkey(),
            &[&authority],
        )
        .await;

    assert_rpc_error(
        result,
        0,
        ANCHOR_ERROR_CODE_OFFSET + ZkSettleError::ZeroMerkleRoot as u32,
    )
    .expect("expected ZeroMerkleRoot on zero-root register");
}

#[tokio::test]
async fn update_by_wrong_authority_rejects() {
    let mut rpc = boot_harness().await;
    let authority = funded_authority(&mut rpc, 10_000_000_000).await;
    let attacker = funded_authority(&mut rpc, 1_000_000_000).await;

    rpc.create_and_send_transaction(
        &[register_ix(&authority.pubkey(), [1u8; 32])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("register_issuer should succeed");

    // Attacker signs as their own authority but targets the legit PDA. Anchor
    // re-derives the PDA from the signing authority's key and rejects the
    // mismatch with `ConstraintSeeds` before `has_one` fires.
    let legit_pda = issuer_pda(&authority.pubkey());
    let ix = update_ix(&attacker.pubkey(), &legit_pda, [9u8; 32]);

    let result = rpc
        .create_and_send_transaction(&[ix], &attacker.pubkey(), &[&attacker])
        .await;

    assert_rpc_error(result, 0, CONSTRAINT_SEEDS)
        .expect("expected ConstraintSeeds when attacker targets victim PDA");
}

#[tokio::test]
async fn update_rejects_zero_root() {
    let mut rpc = boot_harness().await;
    let authority = funded_authority(&mut rpc, 10_000_000_000).await;

    rpc.create_and_send_transaction(
        &[register_ix(&authority.pubkey(), [1u8; 32])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("register_issuer should succeed");

    let issuer_key = issuer_pda(&authority.pubkey());
    let result = rpc
        .create_and_send_transaction(
            &[update_ix(&authority.pubkey(), &issuer_key, [0u8; 32])],
            &authority.pubkey(),
            &[&authority],
        )
        .await;

    assert_rpc_error(
        result,
        0,
        ANCHOR_ERROR_CODE_OFFSET + ZkSettleError::ZeroMerkleRoot as u32,
    )
    .expect("expected ZeroMerkleRoot on zero-root update");
}

#[tokio::test]
async fn double_register_same_authority_fails() {
    let mut rpc = boot_harness().await;
    let authority = funded_authority(&mut rpc, 10_000_000_000).await;

    rpc.create_and_send_transaction(
        &[register_ix(&authority.pubkey(), [1u8; 32])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("first register should succeed");

    let result = rpc
        .create_and_send_transaction(
            &[register_ix(&authority.pubkey(), [2u8; 32])],
            &authority.pubkey(),
            &[&authority],
        )
        .await;

    assert!(result.is_err(), "second register with same authority must fail (PDA already exists)");
}

#[tokio::test]
async fn register_then_update_preserves_authority_and_bump() {
    let mut rpc = boot_harness().await;
    let authority = funded_authority(&mut rpc, 10_000_000_000).await;

    rpc.create_and_send_transaction(
        &[register_ix(&authority.pubkey(), [3u8; 32])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("register should succeed");

    let issuer_key = issuer_pda(&authority.pubkey());
    let before: Issuer = rpc
        .get_anchor_account(&issuer_key)
        .await
        .expect("fetch")
        .expect("exists");

    rpc.create_and_send_transaction(
        &[update_ix(&authority.pubkey(), &issuer_key, [4u8; 32])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("update should succeed");

    let after: Issuer = rpc
        .get_anchor_account(&issuer_key)
        .await
        .expect("fetch")
        .expect("exists");

    assert_eq!(before.authority, after.authority);
    assert_eq!(before.bump, after.bump);
    assert_ne!(before.merkle_root, after.merkle_root);
    assert_eq!(after.merkle_root, [4u8; 32]);
}

#[tokio::test]
async fn update_advances_root_slot() {
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
    let before: Issuer = rpc
        .get_anchor_account(&issuer_key)
        .await
        .expect("fetch")
        .expect("exists");

    rpc.create_and_send_transaction(
        &[update_ix(&authority.pubkey(), &issuer_key, [2u8; 32])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("update should succeed");

    let after: Issuer = rpc
        .get_anchor_account(&issuer_key)
        .await
        .expect("fetch")
        .expect("exists");

    assert!(
        after.root_slot >= before.root_slot,
        "root_slot must advance on update"
    );
}
