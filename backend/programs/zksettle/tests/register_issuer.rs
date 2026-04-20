//! End-to-end tests for `register_issuer` / `update_issuer_root`.
//!
//! Gated behind `#[ignore]` like `verify.rs`: they require the compiled
//! `zksettle.so` produced by `anchor build`.
//!
//! To run locally:
//!   1. `anchor build` from `backend/` so `target/deploy/zksettle.so` exists.
//!   2. `cargo test -- --ignored` from `backend/programs/zksettle/`.

use std::{fs, path::PathBuf};

use anchor_lang::prelude::Pubkey;
use anchor_lang::{system_program, AccountDeserialize, InstructionData};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_instruction::{error::InstructionError, AccountMeta, Instruction};
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;
use solana_transaction_error::TransactionError;

use zksettle::error::ZkSettleError;
use zksettle::instruction::{
    RegisterIssuer as RegisterIssuerIx, UpdateIssuerRoot as UpdateIssuerRootIx,
};
use zksettle::state::{Issuer, ISSUER_SEED};

const ANCHOR_ERROR_CODE_OFFSET: u32 = 6000;
// Anchor built-in `ErrorCode::ConstraintSeeds`.
const CONSTRAINT_SEEDS: u32 = 2006;

fn repo_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop();
    p.pop();
    p.pop();
    p
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

fn issuer_pda(authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[ISSUER_SEED, authority.as_ref()], &zksettle::ID)
}

fn register_ix(authority: &Keypair, merkle_root: [u8; 32]) -> Instruction {
    let (issuer, _) = issuer_pda(&authority.pubkey());
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(authority.pubkey(), true),
            AccountMeta::new(issuer, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: RegisterIssuerIx { merkle_root }.data(),
    }
}

fn update_ix(authority: &Keypair, merkle_root: [u8; 32]) -> Instruction {
    let (issuer, _) = issuer_pda(&authority.pubkey());
    Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new_readonly(authority.pubkey(), true),
            AccountMeta::new(issuer, false),
        ],
        data: UpdateIssuerRootIx { merkle_root }.data(),
    }
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> litesvm::types::TransactionResult {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new(&[ix], Some(&payer.pubkey()));
    let tx = Transaction::new(&[payer], msg, blockhash);
    svm.send_transaction(tx)
}

fn read_issuer(svm: &LiteSVM, pda: &Pubkey) -> Issuer {
    let acct = svm.get_account(pda).expect("issuer account missing");
    Issuer::try_deserialize(&mut acct.data.as_slice()).unwrap()
}

fn expect_code(res: litesvm::types::TransactionResult, want: u32) {
    let failure = res.expect_err("expected tx failure");
    match failure.err {
        TransactionError::InstructionError(_, InstructionError::Custom(code)) if code == want => {}
        other => panic!("expected Custom({want}), got {other:?}"),
    }
}

fn expect_custom(res: litesvm::types::TransactionResult, expected: ZkSettleError) {
    expect_code(res, ANCHOR_ERROR_CODE_OFFSET + expected as u32);
}

#[test]
#[ignore = "requires a prior `anchor build`"]
fn register_then_update_succeeds() {
    let (mut svm, payer) = load_program();
    let root1 = [1u8; 32];
    let root2 = [2u8; 32];

    send(&mut svm, &payer, register_ix(&payer, root1)).expect("register should succeed");

    let (pda, _) = issuer_pda(&payer.pubkey());
    let issuer = read_issuer(&svm, &pda);
    assert_eq!(issuer.authority, payer.pubkey());
    assert_eq!(issuer.merkle_root, root1);
    let slot1 = issuer.root_slot;

    svm.warp_to_slot(slot1 + 10);

    send(&mut svm, &payer, update_ix(&payer, root2)).expect("update should succeed");

    let issuer = read_issuer(&svm, &pda);
    assert_eq!(issuer.merkle_root, root2);
    assert!(issuer.root_slot > slot1);
}

#[test]
#[ignore = "requires a prior `anchor build`"]
fn register_rejects_zero_root() {
    let (mut svm, payer) = load_program();
    let res = send(&mut svm, &payer, register_ix(&payer, [0u8; 32]));
    expect_custom(res, ZkSettleError::ZeroMerkleRoot);
}

#[test]
#[ignore = "requires a prior `anchor build`"]
fn update_by_wrong_authority_rejects() {
    let (mut svm, payer) = load_program();
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    send(&mut svm, &payer, register_ix(&payer, [1u8; 32])).expect("register should succeed");

    // Attacker signs as their own authority but targets the legit PDA. Anchor
    // re-derives the PDA from the signing authority's key and rejects the
    // mismatch with `ConstraintSeeds` before `has_one` fires.
    let (legit_pda, _) = issuer_pda(&payer.pubkey());
    let ix = Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new_readonly(attacker.pubkey(), true),
            AccountMeta::new(legit_pda, false),
        ],
        data: UpdateIssuerRootIx { merkle_root: [9u8; 32] }.data(),
    };
    let res = send(&mut svm, &attacker, ix);
    expect_code(res, CONSTRAINT_SEEDS);
}
