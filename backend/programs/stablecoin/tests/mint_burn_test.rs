#[allow(dead_code)]
mod helpers;

use helpers::*;
use solana_keypair::Keypair;
use solana_signer::Signer;
use stablecoin::error::StablecoinError;

#[test]
fn mint_tokens_happy_path() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_token_account();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 5000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("mint should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_minted, 5000);
    assert_eq!(treasury.total_burned, 0);
}

#[test]
fn mint_tokens_counter_accumulates() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_token_account();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_minted, 3000);
}

#[test]
fn mint_tokens_zero_amount_rejected() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_token_account();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::ZeroMintAmount as u32);
}

#[test]
fn mint_tokens_rejects_non_operator() {
    let TestEnvWithToken { mut svm, admin: _, mint_kp, token_kp } = setup_with_token_account();

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let ix = mint_tokens_ix(&attacker.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedOperator as u32);
}

#[test]
fn burn_tokens_happy_path() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let ix = burn_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("burn should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_minted, 5000);
    assert_eq!(treasury.total_burned, 2000);
}

#[test]
fn burn_tokens_zero_amount_rejected() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(1000);

    let ix = burn_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::ZeroBurnAmount as u32);
}

#[test]
fn burn_tokens_counter_accumulates() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let ix = burn_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = burn_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 500);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_burned, 1500);
}
