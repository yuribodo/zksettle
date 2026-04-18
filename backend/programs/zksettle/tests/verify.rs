use std::{fs, path::PathBuf, process::Command};

use anchor_lang::InstructionData;
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::{Instruction, Message};
use solana_signer::Signer;
use solana_transaction::Transaction;

use zksettle::instruction::VerifyProof as VerifyProofIx;

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
fn valid_proof_passes() {
    let proof_and_witness = gen_proof_and_witness();
    let (mut svm, payer) = load_program();

    let result = submit(&mut svm, &payer, proof_and_witness).expect("tx should succeed");

    let cu = result.compute_units_consumed;
    println!("compute units consumed: {cu}");
    assert!(cu < 200_000, "CU budget exceeded: {cu}");
}

#[test]
fn tampered_proof_rejects() {
    let mut proof_and_witness = gen_proof_and_witness();
    proof_and_witness[0] ^= 0xff;

    let (mut svm, payer) = load_program();
    let result = submit(&mut svm, &payer, proof_and_witness);

    assert!(result.is_err(), "tampered proof should be rejected");
}
