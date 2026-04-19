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
use solana_keypair::Keypair;
use solana_message::{AccountMeta, Instruction, Message};
use solana_signer::Signer;
use solana_transaction::{InstructionError, Transaction, TransactionError};

use common::{gen_fixture, repo_root};
use zksettle::error::ZkSettleError;
use zksettle::instruction::{
    RegisterIssuer as RegisterIssuerIx, VerifyProof as VerifyProofIx,
};
use zksettle::state::{ISSUER_SEED, NULLIFIER_SEED};

const ANCHOR_ERROR_CODE_OFFSET: u32 = 6000;

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

fn submit(
    svm: &mut LiteSVM,
    payer: &Keypair,
    data: Vec<u8>,
    nullifier_hash: [u8; 32],
) -> litesvm::types::TransactionResult {
    let issuer = issuer_pda(&payer.pubkey());
    let ix = Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(issuer, false),
            AccountMeta::new(nullifier_pda(&issuer, &nullifier_hash), false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: VerifyProofIx {
            proof_and_witness: data,
            nullifier_hash,
        }
        .data(),
    };
    send(svm, payer, ix)
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn valid_proof_passes() {
    let fx = gen_fixture(0);
    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, fx.merkle_root);

    let result = submit(&mut svm, &payer, fx.proof_and_witness, fx.nullifier)
        .expect("tx should succeed");

    let cu = result.compute_units_consumed;
    println!("compute units consumed: {cu}");
    assert!(cu < 200_000, "CU budget exceeded: {cu}");
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn tampered_proof_rejects() {
    let fx = gen_fixture(0);
    let mut proof_and_witness = fx.proof_and_witness;
    proof_and_witness[0] ^= 0xff;

    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, fx.merkle_root);
    let failure = submit(&mut svm, &payer, proof_and_witness, fx.nullifier)
        .expect_err("tampered proof should be rejected");

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
