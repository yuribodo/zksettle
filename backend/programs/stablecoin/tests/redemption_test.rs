#[allow(dead_code)]
mod helpers;

use helpers::*;
use solana_keypair::Keypair;
use solana_signer::Signer;
use stablecoin::error::StablecoinError;
use stablecoin::state::REDEMPTION_EXPIRY_SECS;

#[test]
fn request_redemption_happy_path() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000, 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("request_redemption should succeed");

    let (treasury_key, _) = treasury_pda(&mint_kp.pubkey());
    let req = read_redemption_request(&svm, &treasury_key, &admin.pubkey(), 0);
    assert_eq!(req.holder, admin.pubkey());
    assert_eq!(req.amount, 2000);
    assert_eq!(req.nonce, 0);

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.redemption_nonce, 1);
}

#[test]
fn request_redemption_zero_amount_rejected() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(1000);

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0, 0);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::ZeroRedemptionAmount as u32);
}

#[test]
fn request_redemption_paused_rejected() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(1000);

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 500, 0);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::Paused as u32);
}

#[test]
fn request_redemption_already_frozen_rejected() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(1000);

    let ix = freeze_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 500, 0);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::AccountAlreadyFrozen as u32);
}

#[test]
fn approve_redemption_happy_path() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000, 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = approve_redemption_ix(&admin.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("approve_redemption should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_burned, 2000);
    assert_eq!(treasury.total_minted, 5000);
}

#[test]
fn approve_redemption_rejects_non_operator() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000, 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let ix = approve_redemption_ix(&attacker.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedOperator as u32);
}

#[test]
fn cancel_redemption_by_holder() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000, 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = cancel_redemption_ix(&admin.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("cancel by holder should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_burned, 0);
}

#[test]
fn cancel_redemption_by_admin() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let holder = Keypair::new();
    svm.airdrop(&holder.pubkey(), 10_000_000_000).unwrap();
    let holder_token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &holder.pubkey(),
        &holder_token_kp.pubkey(),
        &mint_kp.pubkey(),
        &holder.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &holder, &[&holder, &holder_token_kp]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &holder_token_kp.pubkey(), 3000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = request_redemption_ix(&holder.pubkey(), &mint_kp.pubkey(), &holder_token_kp.pubkey(), 1000, 0);
    send_tx(&mut svm, &[ix], &holder, &[&holder]).unwrap();

    let ix = cancel_redemption_ix(&admin.pubkey(), &holder.pubkey(), &mint_kp.pubkey(), &holder_token_kp.pubkey(), 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("cancel by admin should succeed");
}

#[test]
fn cancel_redemption_unauthorized_rejected() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000, 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let ix = cancel_redemption_ix(&attacker.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedCanceller as u32);
}

#[test]
fn nonce_increments() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000, 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = cancel_redemption_ix(&admin.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 500, 1);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("second request with nonce=1 should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.redemption_nonce, 2);
}

#[test]
fn total_burned_accumulates() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000, 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();
    let ix = approve_redemption_ix(&admin.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 500, 1);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();
    let ix = approve_redemption_ix(&admin.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.total_burned, 1500);
}

#[test]
fn request_redemption_insufficient_balance_rejected() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(1000);

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000, 0);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::InsufficientBalance as u32);
}

#[test]
fn cancel_redemption_by_third_party_after_expiry() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(5000);

    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 2000, 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let third_party = Keypair::new();
    svm.airdrop(&third_party.pubkey(), 1_000_000_000).unwrap();

    let ix = cancel_redemption_ix(&third_party.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    let result = send_tx(&mut svm, &[ix], &third_party, &[&third_party]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedCanceller as u32);

    let mut clock: solana_clock::Clock = svm.get_sysvar();
    clock.unix_timestamp += REDEMPTION_EXPIRY_SECS;
    svm.set_sysvar(&clock);

    let ix = cancel_redemption_ix(&third_party.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    send_tx(&mut svm, &[ix], &third_party, &[&third_party])
        .expect("cancel by third party after expiry should succeed");
}
