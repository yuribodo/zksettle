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

use anchor_lang::prelude::Pubkey;
use anchor_lang::{system_program, InstructionData};
use light_program_test::{utils::assert::assert_rpc_error, LightProgramTest, ProgramTestConfig, Rpc};
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_signer::Signer;

use zksettle::error::ZkSettleError;
use zksettle::instruction::{
    RegisterIssuer as RegisterIssuerIx, UpdateIssuerRoot as UpdateIssuerRootIx,
};
use zksettle::state::{Issuer, ISSUER_SEED};

const ANCHOR_ERROR_CODE_OFFSET: u32 = 6000;
// Anchor built-in `ErrorCode::ConstraintSeeds`.
const CONSTRAINT_SEEDS: u32 = 2006;

fn issuer_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[ISSUER_SEED, authority.as_ref()], &zksettle::ID).0
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

fn update_ix(authority: &Pubkey, issuer: &Pubkey, merkle_root: [u8; 32]) -> Instruction {
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new(*issuer, false),
        ],
        data: UpdateIssuerRootIx { merkle_root }.data(),
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
