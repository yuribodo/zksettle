//! End-to-end verifier tests.
//!
//! These tests are **non-hermetic**: they shell out to `nargo` + `sunspot` to
//! generate a proof/witness, and they load the compiled `zksettle.so` produced
//! by `anchor build`. They are gated behind `#[ignore]` so the default
//! `cargo test` stays green on machines without the toolchain.
//!
//! To run them locally:
//!   1. Install the Noir toolchain (`nargo`) and Reilabs' `sunspot` CLI.
//!   2. Run `anchor build` from `backend/` so `target/deploy/zksettle.so` exists.
//!   3. `cargo test -- --ignored` from `backend/programs/zksettle/`.

use std::{fs, path::PathBuf, process::Command};

use anchor_lang::InstructionData;
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::{Instruction, Message};
use solana_signer::Signer;
use solana_transaction::{InstructionError, Transaction, TransactionError};

use zksettle::error::ZkSettleError;
use zksettle::instruction::VerifyProof as VerifyProofIx;

// Anchor prefixes custom error codes with 6000 (ERROR_CODE_OFFSET).
const ANCHOR_ERROR_CODE_OFFSET: u32 = 6000;

fn repo_root() -> PathBuf {
    // CARGO_MANIFEST_DIR = backend/programs/zksettle
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop(); // programs
    p.pop(); // backend
    p.pop(); // repo root
    p
}

fn circuits_dir() -> PathBuf {
    repo_root().join("circuits")
}

fn gen_proof_and_witness() -> Vec<u8> {
    let circuits = circuits_dir();

    let status = Command::new("nargo")
        .arg("execute")
        .current_dir(&circuits)
        .status()
        .expect("failed to invoke nargo");
    assert!(status.success(), "nargo execute failed");

    let status = Command::new("sunspot")
        .args([
            "prove",
            "target/zksettle_slice.json",
            "target/zksettle_slice.gz",
            "target/zksettle_slice.ccs",
            "target/zksettle_slice.pk",
        ])
        .current_dir(&circuits)
        .status()
        .expect("failed to invoke sunspot");
    assert!(status.success(), "sunspot prove failed");

    let proof = fs::read(circuits.join("target/zksettle_slice.proof")).unwrap();
    let pw = fs::read(circuits.join("target/zksettle_slice.pw")).unwrap();

    [proof, pw].concat()
}

fn load_program() -> (LiteSVM, Keypair) {
    let so_path = repo_root().join("backend/target/deploy/zksettle.so");
    let bytes = fs::read(&so_path).expect("zksettle.so not built — run `anchor build` first");

    let mut svm = LiteSVM::new();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

    svm.add_program(zksettle::ID, &bytes);
    (svm, payer)
}

fn submit(svm: &mut LiteSVM, payer: &Keypair, data: Vec<u8>) -> litesvm::types::TransactionResult {
    let ix = Instruction {
        program_id: zksettle::ID,
        accounts: vec![],
        data: VerifyProofIx {
            proof_and_witness: data,
        }
        .data(),
    };
    let blockhash = svm.latest_blockhash();
    let msg = Message::new(&[ix], Some(&payer.pubkey()));
    let tx = Transaction::new(&[payer], msg, blockhash);
    svm.send_transaction(tx)
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn valid_proof_passes() {
    let proof_and_witness = gen_proof_and_witness();
    let (mut svm, payer) = load_program();

    let result = submit(&mut svm, &payer, proof_and_witness).expect("tx should succeed");

    let cu = result.compute_units_consumed;
    println!("compute units consumed: {cu}");
    assert!(cu < 200_000, "CU budget exceeded: {cu}");
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn tampered_proof_rejects() {
    let mut proof_and_witness = gen_proof_and_witness();
    proof_and_witness[0] ^= 0xff;

    let (mut svm, payer) = load_program();
    let failure = submit(&mut svm, &payer, proof_and_witness)
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
