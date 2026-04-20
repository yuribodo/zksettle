#![allow(dead_code)]

//! Shared helpers for the `#[ignore]` end-to-end tests in `verify.rs` and
//! `nullifier.rs`.
//!
//! Requires: `nargo` (1.0.0-beta.18), `sunspot` on PATH, and a prior
//! `anchor build` so `backend/target/deploy/zksettle.so` exists. Run with:
//!
//!   cargo test -- --ignored --test-threads=1
//!
//! `--test-threads=1` is not strictly required — the helper below serializes
//! fixture generation with a Mutex — but forcing serial runs keeps nargo /
//! sunspot output legible in CI logs.

use std::{
    fmt::Write,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};

use anchor_lang::prelude::Pubkey;
use litesvm::LiteSVM;
use solana_compute_budget_interface::ComputeBudgetInstruction;
use solana_keypair::Keypair;
use solana_message::{Instruction, Message};
use solana_signer::Signer;
use solana_transaction::{InstructionError, Transaction, TransactionError};

use zksettle::error::ZkSettleError;
use zksettle::state::{ATTESTATION_SEED, ISSUER_SEED, NULLIFIER_SEED};

pub const ANCHOR_ERROR_CODE_OFFSET: u32 = 6000;

/// CU budget used for any tx that invokes `verify_proof`. The Groth16 pairing
/// plus 8 public inputs comfortably exceeds the default 200 k ceiling.
pub const VERIFY_CU_LIMIT: u32 = 600_000;

/// Send `ix` with the default CU budget. Use for cheap ixs (register_issuer,
/// update_issuer_root).
pub fn send(
    svm: &mut LiteSVM,
    payer: &Keypair,
    ix: Instruction,
) -> litesvm::types::TransactionResult {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new(&[ix], Some(&payer.pubkey()));
    let tx = Transaction::new(&[payer], msg, blockhash);
    svm.send_transaction(tx)
}

/// Prepend `SetComputeUnitLimit(VERIFY_CU_LIMIT)` and send. Use for any tx
/// that invokes `verify_proof`.
pub fn send_with_budget(
    svm: &mut LiteSVM,
    payer: &Keypair,
    ix: Instruction,
) -> litesvm::types::TransactionResult {
    let budget = ComputeBudgetInstruction::set_compute_unit_limit(VERIFY_CU_LIMIT);
    let blockhash = svm.latest_blockhash();
    let msg = Message::new(&[budget, ix], Some(&payer.pubkey()));
    let tx = Transaction::new(&[payer], msg, blockhash);
    svm.send_transaction(tx)
}

/// Assert the tx failed with `InstructionError::Custom(want)`.
pub fn expect_custom_code(res: litesvm::types::TransactionResult, want: u32) {
    let failure = res.expect_err("expected tx failure");
    match failure.err {
        TransactionError::InstructionError(_, InstructionError::Custom(code)) if code == want => {}
        other => panic!("expected Custom({want}), got {other:?}"),
    }
}

/// Assert the tx failed with a specific `ZkSettleError` variant.
pub fn expect_zksettle(res: litesvm::types::TransactionResult, err: ZkSettleError) {
    expect_custom_code(res, ANCHOR_ERROR_CODE_OFFSET + err as u32);
}

static PROOF_GEN_LOCK: Mutex<()> = Mutex::new(());

pub fn repo_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop(); // programs
    p.pop(); // backend
    p.pop(); // repo root
    p
}

pub fn circuits_dir() -> PathBuf {
    repo_root().join("circuits")
}

pub fn fixture_dir() -> PathBuf {
    repo_root().join("scripts/fixture-noir")
}

#[derive(Clone)]
pub struct Context {
    pub mint: Pubkey,
    pub epoch: u64,
    pub recipient: Pubkey,
    pub amount: u64,
}

impl Context {
    pub fn sample() -> Self {
        // Deterministic pubkeys so repeated gen_fixture calls in a single
        // test produce identical nullifiers (needed for the replay test).
        Self {
            mint: Pubkey::new_from_array([1u8; 32]),
            epoch: 0,
            recipient: Pubkey::new_from_array([2u8; 32]),
            amount: 1_000,
        }
    }
}

pub struct Fixture {
    pub proof_and_witness: Vec<u8>,
    pub merkle_root: [u8; 32],
    pub nullifier: [u8; 32],
    pub ctx: Context,
}

/// Split a pubkey into (lo, hi) u128 limbs (big-endian halves). Mirrors the
/// on-chain `pubkey_to_limbs` helper byte-for-byte.
pub fn pubkey_to_limbs_u128(pk: &Pubkey) -> (u128, u128) {
    let bytes = pk.to_bytes();
    let mut hi = [0u8; 16];
    let mut lo = [0u8; 16];
    hi.copy_from_slice(&bytes[0..16]);
    lo.copy_from_slice(&bytes[16..32]);
    (u128::from_be_bytes(lo), u128::from_be_bytes(hi))
}

/// Run the fixture + slice pipeline end-to-end and return the proof bundle
/// together with the canonical public-input bytes (as seen on-chain).
pub fn gen_fixture(ctx: Context) -> Fixture {
    let _guard = PROOF_GEN_LOCK.lock().unwrap_or_else(|e| e.into_inner());

    let fixture = fixture_dir();
    let circuits = circuits_dir();

    let (mint_lo, mint_hi) = pubkey_to_limbs_u128(&ctx.mint);
    let (rcpt_lo, rcpt_hi) = pubkey_to_limbs_u128(&ctx.recipient);

    let limbs = Limbs {
        mint_lo,
        mint_hi,
        epoch: ctx.epoch,
        recipient_lo: rcpt_lo,
        recipient_hi: rcpt_hi,
        amount: ctx.amount,
    };

    write_prover_toml(&fixture, None, &limbs);
    let (root_hex, null_hex) = run_fixture_and_parse(&fixture);

    write_prover_toml(&circuits, Some((&root_hex, &null_hex)), &limbs);
    run_nargo_execute(&circuits);
    run_sunspot_prove(&circuits);

    let proof = fs::read(circuits.join("target/zksettle_slice.proof")).unwrap();
    let pw = fs::read(circuits.join("target/zksettle_slice.pw")).unwrap();

    // gnark pw layout: 12-byte header (nbPublic/nbSecret/nbVectors as be u32),
    // then nbPublic 32-byte BE field elements. The ADR-020 VK commits to 8.
    const PW_HEADER: usize = 12;
    const PW_EXPECTED: usize = PW_HEADER + 8 * 32;
    let nb_public = u32::from_be_bytes(pw[0..4].try_into().unwrap()) as usize;
    assert_eq!(nb_public, 8, "expected 8 public inputs, got {nb_public}");
    assert_eq!(pw.len(), PW_EXPECTED, "pw len {} != {PW_EXPECTED}", pw.len());
    let merkle_root: [u8; 32] = pw[PW_HEADER..PW_HEADER + 32].try_into().unwrap();
    let nullifier: [u8; 32] = pw[PW_HEADER + 32..PW_HEADER + 64].try_into().unwrap();

    Fixture {
        proof_and_witness: [proof, pw].concat(),
        merkle_root,
        nullifier,
        ctx,
    }
}

struct Limbs {
    mint_lo: u128,
    mint_hi: u128,
    epoch: u64,
    recipient_lo: u128,
    recipient_hi: u128,
    amount: u64,
}

fn write_prover_toml(dir: &Path, pub_inputs: Option<(&str, &str)>, limbs: &Limbs) {
    let body = render_prover_toml(pub_inputs, limbs);
    fs::write(dir.join("Prover.toml"), body).expect("write Prover.toml");
}

fn render_prover_toml(pub_inputs: Option<(&str, &str)>, limbs: &Limbs) -> String {
    let mut s = String::new();
    if let Some((root, null)) = pub_inputs {
        writeln!(&mut s, "merkle_root = \"{root}\"").unwrap();
        writeln!(&mut s, "nullifier   = \"{null}\"").unwrap();
        writeln!(&mut s, "mint_lo = \"{}\"", limbs.mint_lo).unwrap();
        writeln!(&mut s, "mint_hi = \"{}\"", limbs.mint_hi).unwrap();
        writeln!(&mut s, "epoch = \"{}\"", limbs.epoch).unwrap();
        writeln!(&mut s, "recipient_lo = \"{}\"", limbs.recipient_lo).unwrap();
        writeln!(&mut s, "recipient_hi = \"{}\"", limbs.recipient_hi).unwrap();
        writeln!(&mut s, "amount = \"{}\"", limbs.amount).unwrap();
    }
    s.push_str("wallet = \"1\"\n");
    s.push_str("path = [\n");
    for _ in 0..20 {
        s.push_str("    \"0\",\n");
    }
    s.push_str("]\n");
    s.push_str("path_indices = [\n");
    for _ in 0..20 {
        s.push_str("    \"0\",\n");
    }
    s.push_str("]\n");
    s.push_str("private_key = \"42\"\n");
    if pub_inputs.is_none() {
        writeln!(&mut s, "mint_lo = \"{}\"", limbs.mint_lo).unwrap();
        writeln!(&mut s, "mint_hi = \"{}\"", limbs.mint_hi).unwrap();
        writeln!(&mut s, "epoch = \"{}\"", limbs.epoch).unwrap();
        writeln!(&mut s, "recipient_lo = \"{}\"", limbs.recipient_lo).unwrap();
        writeln!(&mut s, "recipient_hi = \"{}\"", limbs.recipient_hi).unwrap();
        writeln!(&mut s, "amount = \"{}\"", limbs.amount).unwrap();
    }
    s
}

fn run_fixture_and_parse(dir: &Path) -> (String, String) {
    let out = Command::new("nargo")
        .arg("execute")
        .current_dir(dir)
        .output()
        .expect("failed to invoke nargo for fixture");
    assert!(
        out.status.success(),
        "fixture nargo execute failed: {}",
        String::from_utf8_lossy(&out.stderr),
    );
    let stdout = String::from_utf8_lossy(&out.stdout);
    parse_circuit_output(&stdout).unwrap_or_else(|| {
        panic!("could not parse fixture 'Circuit output' line:\n{stdout}")
    })
}

/// Parse a line like `[zksettle_fixture] Circuit output: [0xabc.., 0xdef..]`.
fn parse_circuit_output(stdout: &str) -> Option<(String, String)> {
    const MARKER: &str = "Circuit output: [";
    let line = stdout.lines().find(|l| l.contains(MARKER))?;
    let after = &line[line.find(MARKER)? + MARKER.len()..];
    let end = after.find(']')?;
    let mut parts = after[..end].split(',').map(str::trim);
    let root = parts.next()?.to_string();
    let null = parts.next()?.to_string();
    Some((root, null))
}

fn run_nargo_execute(dir: &Path) {
    let status = Command::new("nargo")
        .arg("execute")
        .current_dir(dir)
        .status()
        .expect("failed to invoke nargo");
    assert!(status.success(), "nargo execute failed in {}", dir.display());
}

fn run_sunspot_prove(dir: &Path) {
    let status = Command::new("sunspot")
        .args([
            "prove",
            "target/zksettle_slice.json",
            "target/zksettle_slice.gz",
            "target/zksettle_slice.ccs",
            "target/zksettle_slice.pk",
        ])
        .current_dir(dir)
        .status()
        .expect("failed to invoke sunspot");
    assert!(status.success(), "sunspot prove failed");
}

pub fn load_program() -> (LiteSVM, Keypair) {
    let so_path = repo_root().join("backend/target/deploy/zksettle.so");
    let bytes = fs::read(&so_path).expect("zksettle.so not built — run `anchor build` first");

    let mut svm = LiteSVM::new();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

    let _ = svm.add_program(zksettle::ID, &bytes);
    (svm, payer)
}

pub fn issuer_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[ISSUER_SEED, authority.as_ref()], &zksettle::ID).0
}

pub fn nullifier_pda(issuer: &Pubkey, nullifier_hash: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[NULLIFIER_SEED, issuer.as_ref(), nullifier_hash.as_ref()],
        &zksettle::ID,
    )
    .0
}

pub fn attestation_pda(issuer: &Pubkey, nullifier_hash: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[ATTESTATION_SEED, issuer.as_ref(), nullifier_hash.as_ref()],
        &zksettle::ID,
    )
    .0
}
