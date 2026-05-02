mod helpers;

use helpers::*;
use solana_keypair::Keypair;
use solana_signer::Signer;
use stablecoin::error::StablecoinError;

#[test]
fn freeze_and_thaw_happy_path() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = freeze_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("freeze should succeed");

    let ix = thaw_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("thaw should succeed");
}

#[test]
fn freeze_rejects_non_admin() {
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

    let ix = freeze_account_ix(&attacker.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::UnauthorizedAdmin as u32);
}

#[test]
fn freeze_rejected_when_paused() {
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

    let ix = freeze_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert_anchor_error(result, ANCHOR_ERROR_CODE_OFFSET + StablecoinError::Paused as u32);
}

#[test]
fn thaw_works_when_paused() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = freeze_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = thaw_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("thaw should work while paused");
}

#[test]
fn mint_rejected_after_freeze() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = freeze_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    let result = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    result.expect_err("mint to frozen account should fail");
}

#[test]
fn mint_works_after_thaw() {
    let TestEnv { mut svm, admin, mint_kp, .. } = setup();

    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();

    let ix = freeze_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = thaw_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 1000);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).expect("mint should work after thaw");
}
