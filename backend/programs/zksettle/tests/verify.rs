//! End-to-end verifier tests.
//!
//! These tests are **non-hermetic**: they shell out to `nargo` + `sunspot` to
//! generate a proof/witness, and they load the compiled `zksettle.so` produced
//! by `anchor build`. They are gated behind `#[ignore]` so the default
//! `cargo test` stays green on machines without the toolchain.
//!
//! To run them locally:
//!   1. Install `nargo` (1.0.0-beta.18) and the `sunspot` Go CLI.
//!   2. From `circuits/`: `sunspot compile target/zksettle_slice.json` +
//!      `sunspot setup target/zksettle_slice.ccs` (once, to produce the
//!      committed VK's matching `.ccs` / `.pk`).
//!   3. Run `anchor build` from `backend/` so `target/deploy/zksettle.so`
//!      exists.
//!   4. `cargo test -- --ignored` from `backend/programs/zksettle/`.

mod common;

use std::fs;

use anchor_lang::prelude::Pubkey;
use anchor_lang::{system_program, InstructionData};
use litesvm::LiteSVM;
use solana_clock::Clock;
use solana_keypair::Keypair;
use solana_message::{AccountMeta, Instruction};
use solana_signer::Signer;
use solana_transaction::{InstructionError, TransactionError};

use common::{
    expect_zksettle, gen_fixture, repo_root, send, send_with_budget, Context, Fixture,
    ANCHOR_ERROR_CODE_OFFSET,
};
use zksettle::error::ZkSettleError;
use zksettle::instruction::{RegisterIssuer as RegisterIssuerIx, VerifyProof as VerifyProofIx};
use zksettle::instructions::verify_proof::MAX_ROOT_AGE_SLOTS;
use zksettle::state::{ATTESTATION_SEED, ISSUER_SEED, NULLIFIER_SEED};

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

/// Build a `verify_proof` instruction from a fixture's canonical context.
fn submit(svm: &mut LiteSVM, payer: &Keypair, fx: &Fixture) -> litesvm::types::TransactionResult {
    submit_with(svm, payer, fx, &fx.ctx)
}

/// Submit a `verify_proof` instruction with explicit arg context. Used to
/// force binding mismatches between the proof's canonical tuple and the ix.
fn submit_with(
    svm: &mut LiteSVM,
    payer: &Keypair,
    fx: &Fixture,
    ctx: &Context,
) -> litesvm::types::TransactionResult {
    let issuer = issuer_pda(&payer.pubkey());
    let ix = Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(issuer, false),
            AccountMeta::new(nullifier_pda(&issuer, &fx.nullifier), false),
            AccountMeta::new(attestation_pda(&issuer, &fx.nullifier), false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: VerifyProofIx {
            proof_and_witness: fx.proof_and_witness.clone(),
            nullifier_hash: fx.nullifier,
            mint: ctx.mint,
            epoch: ctx.epoch,
            recipient: ctx.recipient,
            amount: ctx.amount,
        }
        .data(),
    };
    send_with_budget(svm, payer, ix)
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn valid_proof_passes() {
    let fx = gen_fixture(Context::sample());
    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, fx.merkle_root);

    let result = submit(&mut svm, &payer, &fx).expect("tx should succeed");

    let cu = result.compute_units_consumed;
    println!("compute units consumed: {cu}");
    assert!(cu < 600_000, "CU budget exceeded: {cu}");
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn stale_root_rejected() {
    let fx = gen_fixture(Context::sample());
    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, fx.merkle_root);

    let mut clock = svm.get_sysvar::<Clock>();
    clock.slot = clock.slot.saturating_add(MAX_ROOT_AGE_SLOTS + 1);
    svm.set_sysvar::<Clock>(&clock);

    expect_zksettle(submit(&mut svm, &payer, &fx), ZkSettleError::RootStale);
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn tampered_proof_rejects() {
    let mut fx = gen_fixture(Context::sample());
    fx.proof_and_witness[0] ^= 0xff;

    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, fx.merkle_root);
    let failure = submit(&mut svm, &payer, &fx).expect_err("tampered proof should be rejected");

    let expected_invalid = ANCHOR_ERROR_CODE_OFFSET + ZkSettleError::ProofInvalid as u32;
    let expected_malformed = ANCHOR_ERROR_CODE_OFFSET + ZkSettleError::MalformedProof as u32;

    match failure.err {
        TransactionError::InstructionError(_, InstructionError::Custom(code))
            if code == expected_invalid || code == expected_malformed => {}
        other => panic!(
            "expected Custom({expected_invalid}) or Custom({expected_malformed}), got {other:?}"
        ),
    }
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn binding_mismatch_rejected() {
    let fx = gen_fixture(Context::sample());
    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, fx.merkle_root);

    let mut tampered = fx.ctx.clone();
    tampered.amount = tampered.amount.wrapping_add(1);

    expect_zksettle(
        submit_with(&mut svm, &payer, &fx, &tampered),
        ZkSettleError::AmountMismatch,
    );
}
