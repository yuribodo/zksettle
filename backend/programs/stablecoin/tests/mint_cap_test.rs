#[allow(dead_code)]
mod helpers;

use helpers::*;
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use stablecoin::error::StablecoinError;

const CAP: u64 = 10_000_000_000;

fn set_cap(svm: &mut LiteSVM, admin: &Keypair, mint: &Pubkey, cap: u64) {
    let ix = update_mint_cap_ix(&admin.pubkey(), mint, cap);
    send_tx(svm, &[ix], admin, &[admin]).expect("set_cap failed");
}

fn mint(svm: &mut LiteSVM, admin: &Keypair, mint: &Pubkey, dest: &Pubkey, amount: u64) {
    let ix = mint_tokens_ix(&admin.pubkey(), mint, dest, amount);
    send_tx(svm, &[ix], admin, &[admin]).expect("mint failed");
}

fn expect_mint_error(svm: &mut LiteSVM, admin: &Keypair, mint: &Pubkey, dest: &Pubkey, amount: u64, err: StablecoinError) {
    let ix = mint_tokens_ix(&admin.pubkey(), mint, dest, amount);
    let result = send_tx(svm, &[ix], admin, &[admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + err as u32);
}

#[test]
fn update_mint_cap_happy_path() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    set_cap(&mut svm, &admin, &mint_kp.pubkey(), CAP);

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.mint_cap, CAP);
}

#[test]
fn update_mint_cap_rejects_non_admin() {
    let TestEnv { mut svm, admin: _, mint_kp, .. } = setup();

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let ix = update_mint_cap_ix(&attacker.pubkey(), &mint_kp.pubkey(), 1_000);
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedAdmin as u32);
}

#[test]
fn mint_within_cap_succeeds() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    set_cap(&mut svm, &admin, &mint_kp.pubkey(), CAP);
    mint(&mut svm, &admin, &mint_kp.pubkey(), &token_kp.pubkey(), 5_000_000_000);
}

#[test]
fn mint_exactly_at_cap_succeeds() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    set_cap(&mut svm, &admin, &mint_kp.pubkey(), CAP);
    mint(&mut svm, &admin, &mint_kp.pubkey(), &token_kp.pubkey(), CAP);
}

#[test]
fn mint_exceeding_cap_rejected() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    set_cap(&mut svm, &admin, &mint_kp.pubkey(), CAP);
    expect_mint_error(&mut svm, &admin, &mint_kp.pubkey(), &token_kp.pubkey(), CAP + 1, StablecoinError::MintCapExceeded);
}

#[test]
fn mint_exceeding_cap_after_partial() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    set_cap(&mut svm, &admin, &mint_kp.pubkey(), CAP);
    mint(&mut svm, &admin, &mint_kp.pubkey(), &token_kp.pubkey(), 6_000_000_000);
    expect_mint_error(&mut svm, &admin, &mint_kp.pubkey(), &token_kp.pubkey(), 5_000_000_000, StablecoinError::MintCapExceeded);
}

#[test]
fn mint_unlimited_when_cap_zero() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    assert_eq!(read_treasury(&svm, &mint_kp.pubkey()).mint_cap, 0);
    mint(&mut svm, &admin, &mint_kp.pubkey(), &token_kp.pubkey(), 1_000_000_000_000);
}

#[test]
fn update_cap_to_zero_removes_limit() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();

    set_cap(&mut svm, &admin, &mint_kp.pubkey(), 1_000);
    set_cap(&mut svm, &admin, &mint_kp.pubkey(), 0);
    mint(&mut svm, &admin, &mint_kp.pubkey(), &token_kp.pubkey(), 1_000_000_000_000);
}

#[test]
fn cap_below_total_minted_blocks_then_raise_resumes() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp, .. } = setup_with_token_account();
    let m = mint_kp.pubkey();
    let d = token_kp.pubkey();

    set_cap(&mut svm, &admin, &m, CAP);
    mint(&mut svm, &admin, &m, &d, CAP);

    set_cap(&mut svm, &admin, &m, 5_000_000_000);
    expect_mint_error(&mut svm, &admin, &m, &d, 1, StablecoinError::MintCapExceeded);

    set_cap(&mut svm, &admin, &m, 15_000_000_000);
    mint(&mut svm, &admin, &m, &d, 4_000_000_000);
}

#[test]
fn update_mint_cap_rejects_unchanged_value() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    set_cap(&mut svm, &admin, &mint_kp.pubkey(), CAP);

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), CAP);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::MintCapUnchanged as u32);
}

#[test]
fn update_mint_cap_works_while_paused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("pause should succeed");

    set_cap(&mut svm, &admin, &mint_kp.pubkey(), 5_000_000_000);

    assert_eq!(read_treasury(&svm, &mint_kp.pubkey()).mint_cap, 5_000_000_000);
}
