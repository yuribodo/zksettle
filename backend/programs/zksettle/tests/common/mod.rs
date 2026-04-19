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

pub const ANCHOR_ERROR_CODE_OFFSET: u32 = 6000;

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

pub struct Fixture {
    pub proof_and_witness: Vec<u8>,
    pub merkle_root: [u8; 32],
    pub nullifier: [u8; 32],
}

/// Run the fixture + slice pipeline end-to-end and return the proof bundle
/// together with the canonical public-input bytes (as seen on-chain).
///
/// `context_hash` lets callers vary the nullifier: the fixture package
/// derives `nullifier = Poseidon2(private_key, context_hash)`.
pub fn gen_fixture(context_hash: u32) -> Fixture {
    let _guard = PROOF_GEN_LOCK.lock().unwrap_or_else(|e| e.into_inner());

    let fixture = fixture_dir();
    let circuits = circuits_dir();

    write_private_only_prover_toml(&fixture, context_hash);
    let (root_hex, null_hex) = run_fixture_and_parse(&fixture);

    write_main_prover_toml(&circuits, context_hash, &root_hex, &null_hex);
    run_nargo_execute(&circuits);
    run_sunspot_prove(&circuits);

    let proof = fs::read(circuits.join("target/zksettle_slice.proof")).unwrap();
    let pw = fs::read(circuits.join("target/zksettle_slice.pw")).unwrap();

    // gnark pw layout: 12-byte header (nbPublic/nbSecret/nbVectors as be u32),
    // then nbPublic 32-byte BE field elements.
    const PW_HEADER: usize = 12;
    const PW_EXPECTED: usize = PW_HEADER + 2 * 32;
    let nb_public = u32::from_be_bytes(pw[0..4].try_into().unwrap()) as usize;
    assert_eq!(nb_public, 2, "expected 2 public inputs, got {nb_public}");
    assert_eq!(pw.len(), PW_EXPECTED, "pw len {} != {PW_EXPECTED}", pw.len());
    let merkle_root: [u8; 32] = pw[PW_HEADER..PW_HEADER + 32].try_into().unwrap();
    let nullifier: [u8; 32] = pw[PW_HEADER + 32..PW_EXPECTED].try_into().unwrap();

    Fixture {
        proof_and_witness: [proof, pw].concat(),
        merkle_root,
        nullifier,
    }
}

fn write_private_only_prover_toml(dir: &Path, context_hash: u32) {
    let body = render_prover_toml(None, context_hash);
    fs::write(dir.join("Prover.toml"), body).expect("write fixture Prover.toml");
}

fn write_main_prover_toml(dir: &Path, context_hash: u32, merkle_root: &str, nullifier: &str) {
    let body = render_prover_toml(Some((merkle_root, nullifier)), context_hash);
    fs::write(dir.join("Prover.toml"), body).expect("write slice Prover.toml");
}

fn render_prover_toml(pub_inputs: Option<(&str, &str)>, context_hash: u32) -> String {
    let mut s = String::new();
    if let Some((root, null)) = pub_inputs {
        writeln!(&mut s, "merkle_root = \"{root}\"").unwrap();
        writeln!(&mut s, "nullifier   = \"{null}\"").unwrap();
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
    writeln!(&mut s, "context_hash = \"{context_hash}\"").unwrap();
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
