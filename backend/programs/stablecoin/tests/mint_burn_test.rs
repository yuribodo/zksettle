mod helpers;

use helpers::*;
use solana_keypair::Keypair;
use solana_signer::Signer;
use stablecoin::error::StablecoinError;

#[test]
fn mint_tokens_happy_path() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 5000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("mint should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_minted, 5000);
    assert_eq!(treasury.total_burned, 0);
}

#[test]
fn mint_tokens_counter_accumulates() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_minted, 3000);
}

#[test]
fn mint_tokens_zero_amount_rejected() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::ZeroMintAmount as u32);
}

#[test]
fn mint_tokens_rejects_non_operator() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = mint_tokens_ix(&attacker.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedOperator as u32);
}

#[test]
fn burn_tokens_happy_path() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 5000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = burn_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("burn should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_minted, 5000);
    assert_eq!(treasury.total_burned, 2000);
}

#[test]
fn burn_tokens_zero_amount_rejected() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = burn_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::ZeroBurnAmount as u32);
}

#[test]
fn burn_tokens_counter_accumulates() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 5000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = burn_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = burn_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 500);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_burned, 1500);
}
