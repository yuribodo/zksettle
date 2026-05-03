#[allow(dead_code)]
mod helpers;

use helpers::*;
use solana_keypair::Keypair;
use solana_signer::Signer;
use stablecoin::error::StablecoinError;

#[test]
fn update_mint_cap_happy_path() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("update_mint_cap should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.mint_cap, 10_000_000_000);
}

#[test]
fn update_mint_cap_rejects_non_admin() {
    let TestEnv { mut svm, admin: _, mint_kp, .. } = setup();

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let ix = update_mint_cap_ix(&attacker.pubkey(), &mint_kp.pubkey(), 1_000);
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedAdmin as u32,
    );
}

#[test]
fn mint_within_cap_succeeds() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 5_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("mint within cap should succeed");
}

#[test]
fn mint_exactly_at_cap_succeeds() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("mint exactly at cap should succeed");
}

#[test]
fn mint_exceeding_cap_rejected() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 10_000_000_001);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::MintCapExceeded as u32,
    );
}

#[test]
fn mint_exceeding_cap_after_partial() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 6_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("first mint should succeed");

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 5_000_000_000);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::MintCapExceeded as u32,
    );
}

#[test]
fn mint_unlimited_when_cap_zero() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.mint_cap, 0);

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1_000_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("mint should be unlimited when cap is zero");
}

#[test]
fn update_cap_to_zero_removes_limit() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 1_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1_000_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("mint should be unlimited after cap cleared to zero");
}

#[test]
fn cap_below_total_minted_blocks_minting() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("mint up to cap");

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 5_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("lowering cap below total_minted should succeed");

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::MintCapExceeded as u32,
    );
}

#[test]
fn raise_cap_above_total_minted_resumes_minting() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("mint up to cap");

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 5_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("lower cap below total_minted");

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::MintCapExceeded as u32,
    );

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 15_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("raise cap above total_minted");

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 4_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("minting should resume after raising cap");
}

#[test]
fn update_mint_cap_rejects_unchanged_value() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 10_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 10_000_000_000);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::MintCapUnchanged as u32,
    );
}

#[test]
fn update_mint_cap_works_while_paused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("pause should succeed");

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 5_000_000_000);
    send_tx(&mut svm, &[ix], &admin, &[&admin])
        .expect("update_mint_cap should work while paused");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.mint_cap, 5_000_000_000);
}
