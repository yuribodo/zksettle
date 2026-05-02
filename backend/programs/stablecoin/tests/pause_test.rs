mod helpers;

use helpers::*;
use solana_keypair::Keypair;
use solana_signer::Signer;
use stablecoin::error::StablecoinError;

#[test]
fn pause_succeeds_when_unpaused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();
    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("pause should succeed");
}

#[test]
fn unpause_succeeds_when_paused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = unpause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("unpause should succeed");
}

#[test]
fn pause_rejects_non_admin() {
    let TestEnv { mut svm, admin: _, mint_kp, .. } = setup();

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let ix = pause_ix(&attacker.pubkey(), &mint_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);

    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedAdmin as u32,
    );
}

#[test]
fn pause_rejects_already_paused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::AlreadyInState as u32,
    );
}

#[test]
fn unpause_rejects_already_unpaused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let ix = unpause_ix(&admin.pubkey(), &mint_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::AlreadyInState as u32,
    );
}

#[test]
fn mint_rejected_when_paused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::Paused as u32,
    );
}

#[test]
fn burn_rejected_when_paused() {
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

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = burn_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 500);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(
        result,
        ANCHOR_ERROR_CODE_OFFSET + StablecoinError::Paused as u32,
    );
}

#[test]
fn mint_works_after_unpause() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = unpause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("mint should work after unpause");
}
