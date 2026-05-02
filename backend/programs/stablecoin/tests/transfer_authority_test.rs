#[allow(dead_code)]
mod helpers;

use anchor_lang::prelude::Pubkey;
use helpers::*;
use solana_keypair::Keypair;
use solana_signer::Signer;
use stablecoin::error::StablecoinError;

#[test]
fn transfer_admin() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let new_admin = Keypair::new();
    let ix = transfer_authority_ix(
        &admin.pubkey(),
        &mint_kp.pubkey(),
        Some(new_admin.pubkey()),
        None,
    );
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("transfer admin should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.admin, new_admin.pubkey());
    assert_eq!(treasury.operator, admin.pubkey());
}

#[test]
fn transfer_operator() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let new_operator = Keypair::new();
    let ix = transfer_authority_ix(
        &admin.pubkey(),
        &mint_kp.pubkey(),
        None,
        Some(new_operator.pubkey()),
    );
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("transfer operator should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.admin, admin.pubkey());
    assert_eq!(treasury.operator, new_operator.pubkey());
}

#[test]
fn transfer_both() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let new_admin = Keypair::new();
    let new_operator = Keypair::new();
    let ix = transfer_authority_ix(
        &admin.pubkey(),
        &mint_kp.pubkey(),
        Some(new_admin.pubkey()),
        Some(new_operator.pubkey()),
    );
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("transfer both should succeed");

    let treasury = read_treasury(&svm, &mint_kp.pubkey());
    assert_eq!(treasury.admin, new_admin.pubkey());
    assert_eq!(treasury.operator, new_operator.pubkey());
}

#[test]
fn transfer_rejects_non_admin() {
    let TestEnv { mut svm, admin: _, mint_kp, .. } = setup();

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let ix = transfer_authority_ix(
        &attacker.pubkey(),
        &mint_kp.pubkey(),
        Some(attacker.pubkey()),
        None,
    );
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedAdmin as u32);
}

#[test]
fn transfer_rejects_no_change() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = transfer_authority_ix(&admin.pubkey(), &mint_kp.pubkey(), None, None);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::NoAuthorityChange as u32);
}

#[test]
fn transfer_rejects_default_pubkey_admin() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = transfer_authority_ix(
        &admin.pubkey(),
        &mint_kp.pubkey(),
        Some(Pubkey::default()),
        None,
    );
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::InvalidNewAdmin as u32);
}

#[test]
fn transfer_rejects_default_pubkey_operator() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = transfer_authority_ix(
        &admin.pubkey(),
        &mint_kp.pubkey(),
        None,
        Some(Pubkey::default()),
    );
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::InvalidNewOperator as u32);
}

#[test]
fn new_admin_can_act_after_transfer() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let new_admin = Keypair::new();
    svm.airdrop(&new_admin.pubkey(), 1_000_000_000).unwrap();

    let ix = transfer_authority_ix(
        &admin.pubkey(),
        &mint_kp.pubkey(),
        Some(new_admin.pubkey()),
        None,
    );
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = pause_ix(&new_admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &new_admin, &[&new_admin]).expect("new admin should be able to pause");
}

#[test]
fn old_admin_cannot_act_after_transfer() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let new_admin = Keypair::new();
    svm.airdrop(&new_admin.pubkey(), 1_000_000_000).unwrap();

    let ix = transfer_authority_ix(
        &admin.pubkey(),
        &mint_kp.pubkey(),
        Some(new_admin.pubkey()),
        None,
    );
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedAdmin as u32);
}
