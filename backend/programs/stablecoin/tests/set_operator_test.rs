#[allow(dead_code)]
mod helpers;

use anchor_lang::prelude::Pubkey;
use helpers::*;
use solana_keypair::Keypair;
use solana_signer::Signer;
use stablecoin::error::StablecoinError;

#[test]
fn set_operator_happy_path() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let new_operator = Keypair::new();
    let ix = set_operator_ix(&admin.pubkey(), &mint_kp.pubkey(), new_operator.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("set_operator should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.operator, new_operator.pubkey());
}

#[test]
fn set_operator_rejects_non_admin() {
    let TestEnv { mut svm, admin: _, mint_kp, .. } = setup();

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let ix = set_operator_ix(&attacker.pubkey(), &mint_kp.pubkey(), attacker.pubkey());
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedAdmin as u32,
    );
}

#[test]
fn set_operator_rejects_default_pubkey() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = set_operator_ix(&admin.pubkey(), &mint_kp.pubkey(), Pubkey::default());
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::InvalidNewOperator as u32,
    );
}

#[test]
fn new_operator_can_mint() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    let new_operator = Keypair::new();
    svm.airdrop(&new_operator.pubkey(), 1_000_000_000).unwrap();

    let ix = set_operator_ix(&admin.pubkey(), &mint_kp.pubkey(), new_operator.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("set_operator should succeed");

    let ix = mint_tokens_ix(
        &new_operator.pubkey(),
        &mint_kp.pubkey(),
        &token_kp.pubkey(),
        1_000_000,
    );
    send_tx(&mut svm, &[ix], &new_operator, &[&new_operator])
        .expect("new operator should be able to mint");
}

#[test]
fn set_operator_works_while_paused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("pause should succeed");

    let new_operator = Keypair::new();
    let ix = set_operator_ix(&admin.pubkey(), &mint_kp.pubkey(), new_operator.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin])
        .expect("set_operator should work while paused");
}

#[test]
fn set_operator_rejects_same_operator() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    let ix = set_operator_ix(&admin.pubkey(), &mint_kp.pubkey(), treasury.operator);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::OperatorAlreadyCurrent as u32,
    );
}
