mod helpers;

use anchor_lang::prelude::Pubkey;
use anchor_lang::{AnchorDeserialize, Discriminator, Event};
use base64::Engine;
use solana_signer::Signer;

use helpers::*;
use stablecoin::instructions::{
    AccountFrozen, AccountThawed, AdminAccepted, AdminProposed, MintCapUpdated,
    MintInitialized, OperatorUpdated, Paused, PendingAdminCancelled, RedemptionApproved,
    RedemptionCancelled, RedemptionRequested, TokensMinted, Unpaused,
};
use stablecoin::EVENT_VERSION;

fn try_decode_event<T: AnchorDeserialize + Discriminator>(data_b64: &str) -> Option<T> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(data_b64).ok()?;
    if bytes.len() < 8 || bytes[..8] != *T::DISCRIMINATOR {
        return None;
    }
    T::try_from_slice(&bytes[8..]).ok()
}

fn parse_event<T: Event + AnchorDeserialize + Discriminator>(logs: &[String]) -> Option<T> {
    logs.iter()
        .filter_map(|log| log.strip_prefix("Program data: "))
        .find_map(try_decode_event)
}

#[test]
fn mint_initialized_event() {
    let mut svm = litesvm::LiteSVM::new();
    let so_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/stablecoin.so");
    let program_bytes = std::fs::read(so_path).expect("stablecoin.so not found");
    svm.add_program(stablecoin::ID, &program_bytes).unwrap();

    let admin = solana_keypair::Keypair::new();
    svm.airdrop(&admin.pubkey(), 100_000_000_000).unwrap();
    let mint_kp = solana_keypair::Keypair::new();

    let mut ixs = create_mint_account_ix(&admin.pubkey(), &mint_kp.pubkey());
    ixs.push(initialize_mint_ix(&admin.pubkey(), &mint_kp.pubkey(), 6));

    let msg = solana_message::Message::new(&ixs, Some(&admin.pubkey()));
    let tx = solana_transaction::Transaction::new(&[&admin, &mint_kp], msg, svm.latest_blockhash());
    let meta = svm.send_transaction(tx).unwrap();

    let evt: MintInitialized = parse_event(&meta.logs).expect("MintInitialized event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.mint, mint_kp.pubkey());
    assert_eq!(evt.admin, admin.pubkey());
    assert_eq!(evt.operator, admin.pubkey());
}

#[test]
fn tokens_minted_event() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_token_account();
    let ix = mint_tokens_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 500);
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let evt: TokensMinted = parse_event(&meta.logs).expect("TokensMinted event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.mint, mint_kp.pubkey());
    assert_eq!(evt.destination, token_kp.pubkey());
    assert_eq!(evt.amount, 500);
    assert_eq!(evt.operator, admin.pubkey());
}

#[test]
fn redemption_requested_event() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(1000);
    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 300, 0);
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let evt: RedemptionRequested = parse_event(&meta.logs).expect("RedemptionRequested event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.mint, mint_kp.pubkey());
    assert_eq!(evt.holder, admin.pubkey());
    assert_eq!(evt.amount, 300);
    assert_eq!(evt.nonce, 0);
}

#[test]
fn redemption_approved_event() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(1000);
    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 300, 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = approve_redemption_ix(&admin.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let evt: RedemptionApproved = parse_event(&meta.logs).expect("RedemptionApproved event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.mint, mint_kp.pubkey());
    assert_eq!(evt.holder, admin.pubkey());
    assert_eq!(evt.amount, 300);
    assert_eq!(evt.nonce, 0);
    assert_eq!(evt.operator, admin.pubkey());
}

#[test]
fn redemption_cancelled_event() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_funded_token(1000);
    let ix = request_redemption_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 300, 0);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = cancel_redemption_ix(&admin.pubkey(), &admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey(), 0);
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let evt: RedemptionCancelled = parse_event(&meta.logs).expect("RedemptionCancelled event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.mint, mint_kp.pubkey());
    assert_eq!(evt.holder, admin.pubkey());
    assert_eq!(evt.amount, 300);
    assert_eq!(evt.nonce, 0);
    assert_eq!(evt.canceller, admin.pubkey());
}

#[test]
fn freeze_thaw_events() {
    let TestEnvWithToken { mut svm, admin, mint_kp, token_kp } = setup_with_token_account();

    let ix = freeze_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();
    let evt: AccountFrozen = parse_event(&meta.logs).expect("AccountFrozen event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.mint, mint_kp.pubkey());
    assert_eq!(evt.token_account, token_kp.pubkey());
    assert_eq!(evt.admin, admin.pubkey());

    let ix = thaw_account_ix(&admin.pubkey(), &mint_kp.pubkey(), &token_kp.pubkey());
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();
    let evt: AccountThawed = parse_event(&meta.logs).expect("AccountThawed event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.mint, mint_kp.pubkey());
    assert_eq!(evt.token_account, token_kp.pubkey());
    assert_eq!(evt.admin, admin.pubkey());
}

#[test]
fn pause_unpause_events() {
    let TestEnv { mut svm, admin, mint_kp } = setup();

    let ix = pause_ix(&admin.pubkey(), &mint_kp.pubkey());
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();
    let evt: Paused = parse_event(&meta.logs).expect("Paused event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.admin, admin.pubkey());

    let ix = unpause_ix(&admin.pubkey(), &mint_kp.pubkey());
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();
    let evt: Unpaused = parse_event(&meta.logs).expect("Unpaused event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.admin, admin.pubkey());
}

#[test]
fn set_operator_event() {
    let TestEnv { mut svm, admin, mint_kp } = setup();
    let new_op = Pubkey::new_unique();

    let ix = set_operator_ix(&admin.pubkey(), &mint_kp.pubkey(), new_op);
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();
    let evt: OperatorUpdated = parse_event(&meta.logs).expect("OperatorUpdated event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.admin, admin.pubkey());
    assert_eq!(evt.old_operator, admin.pubkey());
    assert_eq!(evt.new_operator, new_op);
}

#[test]
fn propose_accept_admin_events() {
    let TestEnv { mut svm, admin, mint_kp } = setup();
    let new_admin = solana_keypair::Keypair::new();
    svm.airdrop(&new_admin.pubkey(), 10_000_000_000).unwrap();

    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), new_admin.pubkey());
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();
    let evt: AdminProposed = parse_event(&meta.logs).expect("AdminProposed event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.current_admin, admin.pubkey());
    assert_eq!(evt.proposed_admin, new_admin.pubkey());

    let ix = accept_admin_ix(&new_admin.pubkey(), &mint_kp.pubkey());
    let meta = send_tx(&mut svm, &[ix], &new_admin, &[&new_admin]).unwrap();
    let evt: AdminAccepted = parse_event(&meta.logs).expect("AdminAccepted event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.old_admin, admin.pubkey());
    assert_eq!(evt.new_admin, new_admin.pubkey());
}

#[test]
fn cancel_pending_admin_event() {
    let TestEnv { mut svm, admin, mint_kp } = setup();
    let proposed = Pubkey::new_unique();

    let ix = propose_admin_ix(&admin.pubkey(), &mint_kp.pubkey(), proposed);
    send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();

    let ix = cancel_pending_admin_ix(&admin.pubkey(), &mint_kp.pubkey());
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();
    let evt: PendingAdminCancelled = parse_event(&meta.logs).expect("PendingAdminCancelled event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.admin, admin.pubkey());
    assert_eq!(evt.cancelled_pending, proposed);
}

#[test]
fn update_mint_cap_event() {
    let TestEnv { mut svm, admin, mint_kp } = setup();

    let ix = update_mint_cap_ix(&admin.pubkey(), &mint_kp.pubkey(), 5_000_000);
    let meta = send_tx(&mut svm, &[ix], &admin, &[&admin]).unwrap();
    let evt: MintCapUpdated = parse_event(&meta.logs).expect("MintCapUpdated event not found");
    assert_eq!(evt.version, EVENT_VERSION);
    assert_eq!(evt.admin, admin.pubkey());
    assert_eq!(evt.old_cap, 0);
    assert_eq!(evt.new_cap, 5_000_000);
}
