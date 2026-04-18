//! Integration tests for the `verify_proof` nullifier PDA and replay gate.
//!
//! Gated behind `#[ignore]` — requires `nargo` + `sunspot` and a prior
//! `anchor build`. Run with `cargo test -- --ignored` from
//! `backend/programs/zksettle/`.

use std::{fs, path::PathBuf, process::Command};

use anchor_lang::prelude::Pubkey;
use anchor_lang::{system_program, InstructionData};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::{AccountMeta, Instruction, Message};
use solana_signer::Signer;
use solana_transaction::{InstructionError, Transaction, TransactionError};

use zksettle::instruction::{
    RegisterIssuer as RegisterIssuerIx, VerifyProof as VerifyProofIx,
};
use zksettle::state::{ISSUER_SEED, NULLIFIER_SEED};

// Anchor's `init` on an already-initialized account reports
// `ErrorCode::AccountDiscriminatorAlreadySet = 3000`.
const ACCOUNT_DISCRIMINATOR_ALREADY_SET: u32 = 3000;
// `AccountNotInitialized = 3012`.
const ACCOUNT_NOT_INITIALIZED: u32 = 3012;

fn repo_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop();
    p.pop();
    p.pop();
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

fn verify_ix(payer: &Keypair, data: Vec<u8>, nullifier_hash: [u8; 32]) -> Instruction {
    let issuer = issuer_pda(&payer.pubkey());
    Instruction {
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
fn verify_proof_creates_nullifier_pda() {
    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, [1u8; 32]);

    let data = gen_proof_and_witness();
    let nullifier_hash = [7u8; 32];
    send(&mut svm, &payer, verify_ix(&payer, data, nullifier_hash))
        .expect("verify should succeed");

    let acct = svm
        .get_account(&nullifier_pda(&issuer_pda(&payer.pubkey()), &nullifier_hash))
        .expect("nullifier PDA missing");
    assert_eq!(acct.data.len(), 8, "expected discriminator-only account");
    assert_eq!(acct.owner, zksettle::ID);
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn verify_proof_rejects_replay() {
    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, [1u8; 32]);

    let nullifier_hash = [7u8; 32];
    send(
        &mut svm,
        &payer,
        verify_ix(&payer, gen_proof_and_witness(), nullifier_hash),
    )
    .expect("first submit should succeed");

    let res = send(
        &mut svm,
        &payer,
        verify_ix(&payer, gen_proof_and_witness(), nullifier_hash),
    );
    expect_custom_code(res, ACCOUNT_DISCRIMINATOR_ALREADY_SET);
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn verify_proof_allows_fresh_nullifier() {
    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, [1u8; 32]);

    send(
        &mut svm,
        &payer,
        verify_ix(&payer, gen_proof_and_witness(), [7u8; 32]),
    )
    .expect("first submit should succeed");

    send(
        &mut svm,
        &payer,
        verify_ix(&payer, gen_proof_and_witness(), [8u8; 32]),
    )
    .expect("second submit with fresh nullifier should succeed");
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn verify_proof_requires_issuer_pda() {
    let (mut svm, payer) = load_program();
    // Intentionally skip register_issuer so the PDA does not exist.

    let res = send(
        &mut svm,
        &payer,
        verify_ix(&payer, gen_proof_and_witness(), [7u8; 32]),
    );
    expect_custom_code(res, ACCOUNT_NOT_INITIALIZED);
}
