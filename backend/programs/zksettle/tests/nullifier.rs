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
use solana_keypair::Keypair;
use solana_message::{AccountMeta, Instruction, Message};
use solana_signer::Signer;
use solana_transaction::{InstructionError, Transaction, TransactionError};

use common::{gen_fixture, repo_root};
use zksettle::instruction::{
    RegisterIssuer as RegisterIssuerIx, VerifyProof as VerifyProofIx,
};
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

fn send(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> litesvm::types::TransactionResult {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new(&[ix], Some(&payer.pubkey()));
    let tx = Transaction::new(&[payer], msg, blockhash);
    svm.send_transaction(tx)
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

fn verify_ix(payer: &Keypair, data: Vec<u8>, nullifier_hash: [u8; 32]) -> Instruction {
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
            proof_and_witness: data,
            nullifier_hash,
        }
        .data(),
    }
}

fn expect_custom_code(res: litesvm::types::TransactionResult, want: u32) {
    let failure = res.expect_err("expected tx failure");
    match failure.err {
        TransactionError::InstructionError(_, InstructionError::Custom(code)) if code == want => {}
        other => panic!("expected Custom({want}), got {other:?}"),
    }
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn verify_proof_creates_nullifier_and_attestation_pdas() {
    let (mut svm, payer) = load_program();
    let fx = gen_fixture(0);
    register_issuer(&mut svm, &payer, fx.merkle_root);

    let result = send(
        &mut svm,
        &payer,
        verify_ix(&payer, fx.proof_and_witness, fx.nullifier),
    )
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
    assert_eq!(attestation.payer, payer.pubkey());
    assert!(attestation.slot > 0, "slot should be populated");

    let logs = result.logs;
    assert!(
        logs.iter().any(|l| l.contains("Program data:")),
        "expected ProofSettled event log, got {logs:?}",
    );
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn verify_proof_rejects_replay() {
    let (mut svm, payer) = load_program();
    let first = gen_fixture(0);
    register_issuer(&mut svm, &payer, first.merkle_root);

    send(
        &mut svm,
        &payer,
        verify_ix(&payer, first.proof_and_witness, first.nullifier),
    )
    .expect("first submit should succeed");

    // Same context_hash -> same nullifier. The nullifier PDA already exists
    // from the first submit, so `init` fails in the system_program CPI.
    let replay = gen_fixture(0);
    let res = send(
        &mut svm,
        &payer,
        verify_ix(&payer, replay.proof_and_witness, replay.nullifier),
    );
    expect_custom_code(res, ACCOUNT_ALREADY_IN_USE);
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn verify_proof_allows_fresh_nullifier() {
    let (mut svm, payer) = load_program();
    let first = gen_fixture(0);
    register_issuer(&mut svm, &payer, first.merkle_root);

    send(
        &mut svm,
        &payer,
        verify_ix(&payer, first.proof_and_witness, first.nullifier),
    )
    .expect("first submit should succeed");

    let second = gen_fixture(1);
    assert_ne!(
        first.nullifier, second.nullifier,
        "distinct context_hash must yield distinct nullifiers"
    );
    send(
        &mut svm,
        &payer,
        verify_ix(&payer, second.proof_and_witness, second.nullifier),
    )
    .expect("second submit with fresh nullifier should succeed");
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn verify_proof_requires_issuer_pda() {
    let (mut svm, payer) = load_program();
    // Intentionally skip register_issuer so the PDA does not exist.
    let fx = gen_fixture(0);

    let res = send(
        &mut svm,
        &payer,
        verify_ix(&payer, fx.proof_and_witness, fx.nullifier),
    );
    expect_custom_code(res, ACCOUNT_NOT_INITIALIZED);
}
