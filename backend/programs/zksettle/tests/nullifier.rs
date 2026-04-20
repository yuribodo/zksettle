//! Integration tests for the `verify_proof` nullifier PDA and replay gate.
//!
//! Gated behind `#[ignore]` — requires `nargo` + `sunspot` and a prior
//! `anchor build`. Run with `cargo test -- --ignored` from
//! `backend/programs/zksettle/`.

mod common;

use std::fs;

use anchor_lang::prelude::Pubkey;
use anchor_lang::{system_program, AccountDeserialize, InstructionData};
use litesvm::LiteSVM;
use solana_clock::Clock;
use solana_keypair::Keypair;
use solana_instruction::{AccountMeta, Instruction};
use solana_signer::Signer;

use common::{
    expect_custom_code, expect_zksettle, gen_fixture, repo_root, send, send_with_budget, Context,
    Fixture,
};
use zksettle::error::ZkSettleError;
use zksettle::instruction::{RegisterIssuer as RegisterIssuerIx, VerifyProof as VerifyProofIx};
use zksettle::instructions::verify_proof::EPOCH_LEN_SECS;
use zksettle::state::{Attestation, ATTESTATION_SEED, ISSUER_SEED, NULLIFIER_SEED};

// Anchor 1.0's `init` defers to `system_program::create_account`, which
// rejects an existing PDA with `SystemError::AccountAlreadyInUse = 0`
// before Anchor ever gets a chance to compare discriminators.
const ACCOUNT_ALREADY_IN_USE: u32 = 0;
const ACCOUNT_NOT_INITIALIZED: u32 = 3012;

fn load_program() -> (LiteSVM, Keypair) {
    let so_path = repo_root().join("backend/target/deploy/zksettle.so");
    let bytes = fs::read(&so_path).expect("zksettle.so not built — run `anchor build` first");

    let mut svm = LiteSVM::new();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    svm.add_program(zksettle::ID, &bytes);
    (svm, payer)
}

fn issuer_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[ISSUER_SEED, authority.as_ref()], &zksettle::ID).0
}

fn nullifier_pda(issuer: &Pubkey, nullifier_hash: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[NULLIFIER_SEED, issuer.as_ref(), nullifier_hash.as_ref()],
        &zksettle::ID,
    )
    .0
}

fn attestation_pda(issuer: &Pubkey, nullifier_hash: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[ATTESTATION_SEED, issuer.as_ref(), nullifier_hash.as_ref()],
        &zksettle::ID,
    )
    .0
}

fn register_issuer(svm: &mut LiteSVM, authority: &Keypair, merkle_root: [u8; 32]) {
    let ix = Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(authority.pubkey(), true),
            AccountMeta::new(issuer_pda(&authority.pubkey()), false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: RegisterIssuerIx { merkle_root }.data(),
    };
    send(svm, authority, ix).expect("register_issuer should succeed");
}

fn verify_ix(payer: &Keypair, fx: &Fixture, nullifier_hash: [u8; 32]) -> Instruction {
    let issuer = issuer_pda(&payer.pubkey());
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(issuer, false),
            AccountMeta::new(nullifier_pda(&issuer, &nullifier_hash), false),
            AccountMeta::new(attestation_pda(&issuer, &nullifier_hash), false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: VerifyProofIx {
            proof_and_witness: fx.proof_and_witness.clone(),
            nullifier_hash,
            mint: fx.ctx.mint,
            epoch: fx.ctx.epoch,
            recipient: fx.ctx.recipient,
            amount: fx.ctx.amount,
        }
        .data(),
    }
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn verify_proof_creates_nullifier_and_attestation_pdas() {
    let (mut svm, payer) = load_program();
    let fx = gen_fixture(Context::sample());
    register_issuer(&mut svm, &payer, fx.merkle_root);

    let result = send_with_budget(&mut svm, &payer, verify_ix(&payer, &fx, fx.nullifier))
        .expect("verify should succeed");

    let issuer = issuer_pda(&payer.pubkey());

    let nul_acct = svm
        .get_account(&nullifier_pda(&issuer, &fx.nullifier))
        .expect("nullifier PDA missing");
    assert_eq!(nul_acct.data.len(), 8, "expected discriminator-only account");
    assert_eq!(nul_acct.owner, zksettle::ID);

    let att_acct = svm
        .get_account(&attestation_pda(&issuer, &fx.nullifier))
        .expect("attestation PDA missing");
    assert_eq!(att_acct.owner, zksettle::ID);
    let attestation = Attestation::try_deserialize(&mut &att_acct.data[..])
        .expect("attestation should deserialize");
    assert_eq!(attestation.issuer, issuer);
    assert_eq!(attestation.nullifier_hash, fx.nullifier);
    assert_eq!(attestation.merkle_root, fx.merkle_root);
    assert_eq!(attestation.mint, fx.ctx.mint);
    assert_eq!(attestation.recipient, fx.ctx.recipient);
    assert_eq!(attestation.amount, fx.ctx.amount);
    assert_eq!(attestation.epoch, fx.ctx.epoch);
    assert_eq!(attestation.payer, payer.pubkey());

    let logs = result.logs;
    assert!(
        logs.iter().any(|l| l.contains("Program data:")),
        "expected ProofSettled event log, got {logs:?}",
    );
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn same_tuple_same_nullifier() {
    let (mut svm, payer) = load_program();
    let first = gen_fixture(Context::sample());
    register_issuer(&mut svm, &payer, first.merkle_root);

    send_with_budget(&mut svm, &payer, verify_ix(&payer, &first, first.nullifier))
        .expect("first submit should succeed");

    // Same (mint, epoch, recipient, amount) tuple → same nullifier. The
    // nullifier PDA already exists from the first submit, so `init` fails
    // in the system_program CPI.
    let replay = gen_fixture(Context::sample());
    assert_eq!(first.nullifier, replay.nullifier);
    let res = send_with_budget(&mut svm, &payer, verify_ix(&payer, &replay, replay.nullifier));
    expect_custom_code(res, ACCOUNT_ALREADY_IN_USE);
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn different_recipient_yields_different_nullifier() {
    let (mut svm, payer) = load_program();
    let first = gen_fixture(Context::sample());
    register_issuer(&mut svm, &payer, first.merkle_root);

    send_with_budget(&mut svm, &payer, verify_ix(&payer, &first, first.nullifier))
        .expect("first submit should succeed");

    let mut second_ctx = Context::sample();
    second_ctx.recipient = Pubkey::new_from_array([9u8; 32]);
    let second = gen_fixture(second_ctx);
    assert_ne!(
        first.nullifier, second.nullifier,
        "distinct recipient must yield distinct nullifiers",
    );
    send_with_budget(&mut svm, &payer, verify_ix(&payer, &second, second.nullifier))
        .expect("second submit with fresh nullifier should succeed");
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn verify_proof_rejects_zero_nullifier() {
    let (mut svm, payer) = load_program();
    let fx = gen_fixture(Context::sample());
    register_issuer(&mut svm, &payer, fx.merkle_root);

    let res = send_with_budget(&mut svm, &payer, verify_ix(&payer, &fx, [0u8; 32]));
    expect_zksettle(res, ZkSettleError::ZeroNullifier);
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn epoch_in_future_rejected() {
    let (mut svm, payer) = load_program();
    // Default LiteSVM clock has unix_timestamp = 0 → current_epoch = 0.
    // A proof for epoch = 1 is in the future and must be rejected before
    // the pairing check ever runs.
    let mut ctx = Context::sample();
    ctx.epoch = 1;
    let fx = gen_fixture(ctx);
    register_issuer(&mut svm, &payer, fx.merkle_root);

    let res = send_with_budget(&mut svm, &payer, verify_ix(&payer, &fx, fx.nullifier));
    expect_zksettle(res, ZkSettleError::EpochInFuture);
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn epoch_too_old_rejected() {
    let (mut svm, payer) = load_program();
    let fx = gen_fixture(Context::sample()); // epoch = 0
    register_issuer(&mut svm, &payer, fx.merkle_root);

    // Warp unix_timestamp two epochs forward while leaving the slot alone
    // so RootStale does not fire first.
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = 2 * EPOCH_LEN_SECS;
    svm.set_sysvar::<Clock>(&clock);

    let res = send_with_budget(&mut svm, &payer, verify_ix(&payer, &fx, fx.nullifier));
    expect_zksettle(res, ZkSettleError::EpochStale);
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn verify_proof_requires_issuer_pda() {
    let (mut svm, payer) = load_program();
    // Intentionally skip register_issuer so the PDA does not exist.
    let fx = gen_fixture(Context::sample());

    let res = send_with_budget(&mut svm, &payer, verify_ix(&payer, &fx, fx.nullifier));
    expect_custom_code(res, ACCOUNT_NOT_INITIALIZED);
}
