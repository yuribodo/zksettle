#![cfg(all(feature = "light-tests", unix))]

mod helpers;

use anchor_lang::prelude::Pubkey;
use light_program_test::{program_test::TestRpc, utils::assert::assert_rpc_error, Rpc};
use solana_keypair::Keypair;
use solana_signer::Signer;

use zksettle::constants::MAX_ROOT_AGE_SLOTS;
use zksettle::error::ZkSettleError;

use helpers::{
    boot_cross_program_harness, default_light_args, funded_authority, init_attestation_tree_ix,
    init_extra_meta_ix, issuer_pda, nonzero_nullifier, register_ix, set_hook_payload_ix,
    settle_hook_ix, settle_pda_keys, ANCHOR_ERROR_CODE_OFFSET,
};
use helpers::stablecoin_ixs::{
    approve_redemption_ix, create_stablecoin_mint_with_hook_ixs, create_token2022_account_ixs,
    freeze_account_ix, mint_tokens_ix, request_redemption_ix, transfer_checked_no_hook_ix,
    treasury_pda,
};

fn default_extra_meta(
    authority: &Pubkey,
) -> zksettle::instructions::transfer_hook::ExtraAccountMetaInput {
    zksettle::instructions::transfer_hook::ExtraAccountMetaInput {
        discriminator: 0,
        address_config: authority.to_bytes(),
        is_signer: false,
        is_writable: true,
    }
}

struct SettleScenario {
    admin: Keypair,
    mint: Pubkey,
    token_kp: Keypair,
    issuer_key: Pubkey,
    merkle_tree_kp: Keypair,
}

impl SettleScenario {
    fn settle_pda_keys(&self) -> (Pubkey, Pubkey, Pubkey) {
        settle_pda_keys(&self.merkle_tree_kp.pubkey())
    }

    async fn stage_payload(
        &self,
        rpc: &mut light_program_test::LightProgramTest,
        recipient: Pubkey,
        amount: u64,
    ) {
        rpc.create_and_send_transaction(
            &[set_hook_payload_ix(
                &self.admin.pubkey(),
                &self.issuer_key,
                vec![0xaa; 256],
                nonzero_nullifier(),
                self.mint,
                10,
                recipient,
                amount,
                default_light_args(),
            )],
            &self.admin.pubkey(),
            &[&self.admin],
        )
        .await
        .expect("set_hook_payload");
    }

    async fn attempt_settle(
        &self,
        rpc: &mut light_program_test::LightProgramTest,
        recipient: &Pubkey,
        amount: u64,
    ) -> Result<solana_signature::Signature, Box<dyn std::error::Error>> {
        let (registry_key, tree_creator_key, tree_config_key) = self.settle_pda_keys();

        rpc.create_and_send_transaction(
            &[settle_hook_ix(
                &self.admin.pubkey(),
                &self.mint,
                recipient,
                &self.issuer_key,
                &registry_key,
                &self.merkle_tree_kp.pubkey(),
                &tree_config_key,
                &tree_creator_key,
                amount,
            )],
            &self.admin.pubkey(),
            &[&self.admin],
        )
        .await
    }
}

async fn setup_settle_scenario(
    rpc: &mut light_program_test::LightProgramTest,
) -> SettleScenario {
    let admin = funded_authority(rpc, 10_000_000_000).await;
    let mint_kp = setup_stablecoin_mint(rpc, &admin).await;
    let mint = mint_kp.pubkey();

    let token_kp = setup_token_account(rpc, &admin, &mint, &admin.pubkey()).await;
    rpc.create_and_send_transaction(
        &[mint_tokens_ix(&admin.pubkey(), &mint, &token_kp.pubkey(), 5000)],
        &admin.pubkey(),
        &[&admin],
    )
    .await
    .expect("mint_tokens");

    rpc.create_and_send_transaction(
        &[register_ix(&admin.pubkey(), [1u8; 32])],
        &admin.pubkey(),
        &[&admin],
    )
    .await
    .expect("register_issuer");
    let issuer_key = issuer_pda(&admin.pubkey());

    let merkle_tree_kp = Keypair::new();
    rpc.create_and_send_transaction(
        &[init_attestation_tree_ix(&admin.pubkey(), &merkle_tree_kp.pubkey())],
        &admin.pubkey(),
        &[&admin, &merkle_tree_kp],
    )
    .await
    .expect("init_attestation_tree");

    rpc.create_and_send_transaction(
        &[init_extra_meta_ix(
            &admin.pubkey(),
            &mint,
            vec![default_extra_meta(&admin.pubkey())],
        )],
        &admin.pubkey(),
        &[&admin],
    )
    .await
    .expect("init_extra_account_meta_list");

    SettleScenario { admin, mint, token_kp, issuer_key, merkle_tree_kp }
}

async fn setup_stablecoin_mint(
    rpc: &mut light_program_test::LightProgramTest,
    admin: &Keypair,
) -> Keypair {
    let mint_kp = Keypair::new();
    let ixs = create_stablecoin_mint_with_hook_ixs(&admin.pubkey(), &mint_kp.pubkey(), 6);
    rpc.create_and_send_transaction(&ixs, &admin.pubkey(), &[admin, &mint_kp])
        .await
        .expect("create stablecoin mint with hook");
    mint_kp
}

async fn setup_token_account(
    rpc: &mut light_program_test::LightProgramTest,
    payer: &Keypair,
    mint: &Pubkey,
    owner: &Pubkey,
) -> Keypair {
    let account_kp = Keypair::new();
    let ixs = create_token2022_account_ixs(&payer.pubkey(), &account_kp.pubkey(), mint, owner);
    rpc.create_and_send_transaction(&ixs, &payer.pubkey(), &[payer, &account_kp])
        .await
        .expect("create token account");
    account_kp
}

#[tokio::test]
async fn stablecoin_mint_then_settle_hook_boundary() {
    let mut rpc = boot_cross_program_harness().await;
    let s = setup_settle_scenario(&mut rpc).await;

    let recipient = Pubkey::new_unique();
    s.stage_payload(&mut rpc, recipient, 500).await;
    let result = s.attempt_settle(&mut rpc, &recipient, 500).await;

    assert_rpc_error(
        result,
        0,
        ANCHOR_ERROR_CODE_OFFSET + ZkSettleError::MalformedProof as u32,
    )
    .expect("expected MalformedProof at gnark verification boundary");
}

#[tokio::test]
async fn frozen_account_rejects_transfer() {
    let mut rpc = boot_cross_program_harness().await;
    let admin = funded_authority(&mut rpc, 10_000_000_000).await;

    let mint_kp = setup_stablecoin_mint(&mut rpc, &admin).await;
    let mint = mint_kp.pubkey();

    let sender_kp = setup_token_account(&mut rpc, &admin, &mint, &admin.pubkey()).await;

    rpc.create_and_send_transaction(
        &[mint_tokens_ix(&admin.pubkey(), &mint, &sender_kp.pubkey(), 5000)],
        &admin.pubkey(),
        &[&admin],
    )
    .await
    .expect("mint_tokens to sender");

    let recipient = funded_authority(&mut rpc, 10_000_000_000).await;
    let recipient_kp = setup_token_account(&mut rpc, &admin, &mint, &recipient.pubkey()).await;

    // Freeze sender account
    rpc.create_and_send_transaction(
        &[freeze_account_ix(&admin.pubkey(), &mint, &sender_kp.pubkey())],
        &admin.pubkey(),
        &[&admin],
    )
    .await
    .expect("freeze_account");

    // Attempt transfer — should fail with AccountFrozen
    let result = rpc
        .create_and_send_transaction(
            &[transfer_checked_no_hook_ix(
                &sender_kp.pubkey(),
                &mint,
                &recipient_kp.pubkey(),
                &admin.pubkey(),
                1000,
                6,
            )],
            &admin.pubkey(),
            &[&admin],
        )
        .await;

    assert_rpc_error(result, 0, 17).expect("expected AccountFrozen");
}

#[tokio::test]
async fn redemption_after_failed_settlement() {
    let mut rpc = boot_cross_program_harness().await;
    let s = setup_settle_scenario(&mut rpc).await;

    let recipient = Pubkey::new_unique();
    s.stage_payload(&mut rpc, recipient, 500).await;
    let result = s.attempt_settle(&mut rpc, &recipient, 500).await;

    assert_rpc_error(
        result,
        0,
        ANCHOR_ERROR_CODE_OFFSET + ZkSettleError::MalformedProof as u32,
    )
    .expect("expected MalformedProof");

    rpc.create_and_send_transaction(
        &[request_redemption_ix(&s.admin.pubkey(), &s.mint, &s.token_kp.pubkey(), 2000, 0)],
        &s.admin.pubkey(),
        &[&s.admin],
    )
    .await
    .expect("request_redemption should succeed after failed settlement");

    rpc.create_and_send_transaction(
        &[approve_redemption_ix(&s.admin.pubkey(), &s.admin.pubkey(), &s.mint, &s.token_kp.pubkey(), 0)],
        &s.admin.pubkey(),
        &[&s.admin],
    )
    .await
    .expect("approve_redemption should succeed");

    let (treasury_key, _) = treasury_pda(&s.mint);
    let treasury: stablecoin::state::Treasury = rpc
        .get_anchor_account(&treasury_key)
        .await
        .expect("fetch")
        .expect("treasury must exist");
    assert_eq!(treasury.total_burned, 2000);
}

#[tokio::test]
async fn stale_root_rejects_settlement() {
    let mut rpc = boot_cross_program_harness().await;
    let s = setup_settle_scenario(&mut rpc).await;

    let recipient = Pubkey::new_unique();
    s.stage_payload(&mut rpc, recipient, 500).await;

    rpc.warp_to_slot(MAX_ROOT_AGE_SLOTS + 100).expect("warp_to_slot");

    let result = s.attempt_settle(&mut rpc, &recipient, 500).await;

    assert_rpc_error(
        result,
        0,
        ANCHOR_ERROR_CODE_OFFSET + ZkSettleError::RootStale as u32,
    )
    .expect("expected RootStale after slot warp");
}

#[tokio::test]
#[ignore = "requires gnark fixture at tests/fixtures/proof_and_witness.bin (ADR-006)"]
async fn full_e2e_transfer_hook_fires() {
    let mut rpc = boot_cross_program_harness().await;
    let admin = funded_authority(&mut rpc, 10_000_000_000).await;

    let mint_kp = setup_stablecoin_mint(&mut rpc, &admin).await;
    let mint = mint_kp.pubkey();

    let sender_kp = setup_token_account(&mut rpc, &admin, &mint, &admin.pubkey()).await;
    let recipient = funded_authority(&mut rpc, 10_000_000_000).await;
    let recipient_kp = setup_token_account(&mut rpc, &admin, &mint, &recipient.pubkey()).await;

    rpc.create_and_send_transaction(
        &[mint_tokens_ix(&admin.pubkey(), &mint, &sender_kp.pubkey(), 5000)],
        &admin.pubkey(),
        &[&admin],
    )
    .await
    .expect("mint_tokens");

    // TODO: load real gnark proof from tests/fixtures/proof_and_witness.bin
    let _fixture_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/proof_and_witness.bin");

    let _ = (&rpc, &mint, &sender_kp, &recipient_kp);
}
