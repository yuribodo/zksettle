#[allow(dead_code)]
mod helpers;

use anchor_lang::prelude::Pubkey;
use helpers::*;
use solana_keypair::Keypair;
use solana_signer::Signer;
use stablecoin::error::StablecoinError;

fn propose_and_accept(
    svm: &mut litesvm::LiteSVM,
    admin: &Keypair,
    mint: &Pubkey,
    new_admin: &Keypair,
) {
    let ix = propose_admin_ix(&admin.pubkey(), mint, new_admin.pubkey());
    send_tx(svm, &[ix], admin, &[admin]).expect("propose should succeed");

    let ix = accept_admin_ix(&new_admin.pubkey(), mint);
    send_tx(svm, &[ix], new_admin, &[new_admin]).expect("accept should succeed");
}

#[test]
fn propose_and_accept_admin() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let new_admin = Keypair::new();
    svm.airdrop(&new_admin.pubkey(), 1_000_000_000).unwrap();

    propose_and_accept(&mut svm, &admin, &mint_kp.pubkey(), &new_admin);

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.admin, new_admin.pubkey());
    assert!(treasury.pending_admin.is_none());
}

#[test]
fn propose_admin_rejects_non_admin() {
    let TestEnv { mut svm, admin: _, mint_kp, .. } = setup();

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let ix = propose_admin_ix(&attacker.pubkey(), &mint_kp.pubkey(), attacker.pubkey());
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedAdmin as u32,
    );
}

#[test]
fn propose_admin_rejects_default_pubkey() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), Pubkey::default());
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::InvalidNewAdmin as u32,
    );
}

#[test]
fn propose_admin_rejects_current_admin() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), admin.pubkey());
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::AdminAlreadyCurrent as u32,
    );
}

#[test]
fn accept_admin_rejects_wrong_signer() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let proposed = Keypair::new();
    svm.airdrop(&proposed.pubkey(), 1_000_000_000).unwrap();

    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), proposed.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("propose should succeed");

    let wrong = Keypair::new();
    svm.airdrop(&wrong.pubkey(), 1_000_000_000).unwrap();
    let ix = accept_admin_ix(&wrong.pubkey(), &mint_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &wrong, &[&wrong]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::NotPendingAdmin as u32,
    );
}

#[test]
fn accept_admin_rejects_when_no_pending() {
    let TestEnv { mut svm, admin: _, mint_kp, .. } = setup();

    let random = Keypair::new();
    svm.airdrop(&random.pubkey(), 1_000_000_000).unwrap();

    let ix = accept_admin_ix(&random.pubkey(), &mint_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &random, &[&random]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::NotPendingAdmin as u32,
    );
}

#[test]
fn propose_overwrites_pending() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let first = Keypair::new();
    svm.airdrop(&first.pubkey(), 1_000_000_000).unwrap();
    let second = Keypair::new();
    svm.airdrop(&second.pubkey(), 1_000_000_000).unwrap();

    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), first.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("first propose should succeed");

    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), second.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("second propose should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.pending_admin, Some(second.pubkey()));

    let ix = accept_admin_ix(&first.pubkey(), &mint_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &first, &[&first]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::NotPendingAdmin as u32,
    );

    let ix = accept_admin_ix(&second.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &second, &[&second]).expect("second should accept");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.admin, second.pubkey());
}

#[test]
fn old_admin_cannot_act_after_accept() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let new_admin = Keypair::new();
    svm.airdrop(&new_admin.pubkey(), 1_000_000_000).unwrap();
    propose_and_accept(&mut svm, &admin, &mint_kp.pubkey(), &new_admin);

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedAdmin as u32,
    );
}

#[test]
fn new_admin_can_act_after_accept() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let new_admin = Keypair::new();
    svm.airdrop(&new_admin.pubkey(), 1_000_000_000).unwrap();
    propose_and_accept(&mut svm, &admin, &mint_kp.pubkey(), &new_admin);

    let ix = pause_ix(&new_admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &new_admin, &[&new_admin]).expect("new admin should be able to pause");
}

#[test]
fn propose_admin_works_while_paused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("pause should succeed");

    let new_admin = Keypair::new();
    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), new_admin.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("propose should work while paused");
}

#[test]
fn accept_admin_works_while_paused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let new_admin = Keypair::new();
    svm.airdrop(&new_admin.pubkey(), 1_000_000_000).unwrap();

    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), new_admin.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("propose should succeed");

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("pause should succeed");

    let ix = accept_admin_ix(&new_admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &new_admin, &[&new_admin]).expect("accept should work while paused");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.admin, new_admin.pubkey());
}

#[test]
fn cancel_pending_admin_clears_pending() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let proposed = Keypair::new();
    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), proposed.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("propose should succeed");

    let ix = cancel_pending_admin_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("cancel should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert!(treasury.pending_admin.is_none());
}

#[test]
fn cancel_pending_admin_rejects_when_no_pending() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = cancel_pending_admin_ix(&admin.pubkey(), &mint_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::NoPendingAdmin as u32,
    );
}

#[test]
fn cancel_pending_admin_rejects_non_admin() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let proposed = Keypair::new();
    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), proposed.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("propose should succeed");

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();
    let ix = cancel_pending_admin_ix(&attacker.pubkey(), &mint_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedAdmin as u32,
    );
}

#[test]
fn cancel_pending_admin_works_while_paused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let proposed = Keypair::new();
    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), proposed.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("propose should succeed");

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("pause should succeed");

    let ix = cancel_pending_admin_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("cancel should work while paused");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert!(treasury.pending_admin.is_none());
}
