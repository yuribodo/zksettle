#![cfg(feature = "legacy-pda-tests")]

mod common;

use anchor_lang::{system_program, InstructionData};
use litesvm::LiteSVM;
use solana_clock::Clock;
use solana_keypair::Keypair;
use solana_instruction::{AccountMeta, Instruction};
use solana_signer::Signer;

use common::{
    attestation_pda, expect_custom_code, expect_zksettle, gen_fixture, issuer_pda, load_program,
    nullifier_pda, send, send_with_budget, Context,
};
use zksettle::constants::MAX_ROOT_AGE_SLOTS;
use zksettle::error::ZkSettleError;
use zksettle::instruction::{
    CheckAttestation as CheckAttestationIx, RegisterIssuer as RegisterIssuerIx,
    VerifyProof as VerifyProofIx,
};

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

fn do_verify_proof(svm: &mut LiteSVM, payer: &Keypair, ctx: &Context, proof_and_witness: &[u8], nullifier: &[u8; 32]) {
    let issuer = issuer_pda(&payer.pubkey());
    let ix = Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(issuer, false),
            AccountMeta::new(nullifier_pda(&issuer, nullifier), false),
            AccountMeta::new(attestation_pda(&issuer, nullifier), false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: VerifyProofIx {
            proof_and_witness: proof_and_witness.to_vec(),
            nullifier_hash: *nullifier,
            mint: ctx.mint,
            epoch: ctx.epoch,
            recipient: ctx.recipient,
            amount: ctx.amount,
        }
        .data(),
    };
    send_with_budget(svm, payer, ix).expect("verify_proof should succeed");
}

fn check_attestation(
    svm: &mut LiteSVM,
    payer: &Keypair,
    issuer_authority: &anchor_lang::prelude::Pubkey,
    nullifier_hash: [u8; 32],
) -> litesvm::types::TransactionResult {
    let issuer = issuer_pda(issuer_authority);
    let ix = Instruction {
        program_id: zksettle::ID,
        accounts: vec![
            AccountMeta::new_readonly(issuer, false),
            AccountMeta::new_readonly(attestation_pda(&issuer, &nullifier_hash), false),
        ],
        data: CheckAttestationIx { nullifier_hash }.data(),
    };
    send(svm, payer, ix)
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn valid_attestation_passes() {
    let fx = gen_fixture(Context::sample());
    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, fx.merkle_root);
    do_verify_proof(&mut svm, &payer, &fx.ctx, &fx.proof_and_witness, &fx.nullifier);

    check_attestation(&mut svm, &payer, &payer.pubkey(), fx.nullifier)
        .expect("check_attestation should succeed for fresh attestation");
}

#[test]
#[ignore = "requires nargo+sunspot toolchain and a prior `anchor build`"]
fn expired_attestation_rejected() {
    let fx = gen_fixture(Context::sample());
    let (mut svm, payer) = load_program();
    register_issuer(&mut svm, &payer, fx.merkle_root);
    do_verify_proof(&mut svm, &payer, &fx.ctx, &fx.proof_and_witness, &fx.nullifier);

    let mut clock = svm.get_sysvar::<Clock>();
    clock.slot = clock.slot.saturating_add(MAX_ROOT_AGE_SLOTS + 1);
    svm.set_sysvar::<Clock>(&clock);

    let res = check_attestation(&mut svm, &payer, &payer.pubkey(), fx.nullifier);
    expect_zksettle(res, ZkSettleError::AttestationExpired);
}

#[test]
#[ignore = "requires a prior `anchor build`"]
fn nonexistent_attestation_rejected() {
    let (mut svm, payer) = load_program();

    let merkle_root = [1u8; 32];
    register_issuer(&mut svm, &payer, merkle_root);

    let random_nullifier = [99u8; 32];
    let res = check_attestation(&mut svm, &payer, &payer.pubkey(), random_nullifier);
    expect_custom_code(res, 3012);
}
