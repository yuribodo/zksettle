use anchor_lang::prelude::Pubkey;
use light_program_test::{LightProgramTest, ProgramTestConfig, Rpc};
use solana_keypair::Keypair;
use solana_signer::Signer;

use super::instructions::{issuer_pda, register_ix};

pub async fn boot_harness() -> LightProgramTest {
    let config = ProgramTestConfig::new_v2(false, Some(vec![("zksettle", zksettle::ID)]));
    LightProgramTest::new(config)
        .await
        .expect("boot light harness")
}

pub async fn funded_authority(rpc: &mut LightProgramTest, lamports: u64) -> Keypair {
    let kp = Keypair::new();
    rpc.airdrop_lamports(&kp.pubkey(), lamports)
        .await
        .expect("airdrop");
    kp
}

pub async fn registered_issuer(rpc: &mut LightProgramTest) -> (Keypair, Pubkey) {
    let authority = funded_authority(rpc, 10_000_000_000).await;
    rpc.create_and_send_transaction(
        &[register_ix(&authority.pubkey(), [1u8; 32])],
        &authority.pubkey(),
        &[&authority],
    )
    .await
    .expect("register issuer");
    let issuer_key = issuer_pda(&authority.pubkey());
    (authority, issuer_key)
}

pub async fn initialized_tree(rpc: &mut LightProgramTest) -> (Keypair, Pubkey, Keypair) {
    let (authority, issuer_key) = registered_issuer(rpc).await;
    let merkle_tree_kp = Keypair::new();

    rpc.create_and_send_transaction(
        &[super::instructions::init_attestation_tree_ix(
            &authority.pubkey(),
            &merkle_tree_kp.pubkey(),
        )],
        &authority.pubkey(),
        &[&authority, &merkle_tree_kp],
    )
    .await
    .expect("init_attestation_tree should succeed");

    (authority, issuer_key, merkle_tree_kp)
}

pub fn nonzero_nullifier() -> [u8; 32] {
    let mut n = [0u8; 32];
    n[0] = 1;
    n
}

pub async fn mint_with_extra_meta(
    rpc: &mut LightProgramTest,
    authority: &solana_keypair::Keypair,
) -> Keypair {
    let mint_kp = Keypair::new();
    let mint_ixs =
        super::instructions::create_token2022_mint_with_hook_ixs(&authority.pubkey(), &mint_kp.pubkey(), 6);
    rpc.create_and_send_transaction(&mint_ixs, &authority.pubkey(), &[authority, &mint_kp])
        .await
        .expect("create Token-2022 mint");

    let meta = zksettle::instructions::transfer_hook::ExtraAccountMetaInput {
        discriminator: 0,
        address_config: authority.pubkey().to_bytes(),
        is_signer: false,
        is_writable: true,
    };
    rpc.create_and_send_transaction(
        &[super::instructions::init_extra_meta_ix(
            &authority.pubkey(),
            &mint_kp.pubkey(),
            vec![meta],
        )],
        &authority.pubkey(),
        &[authority],
    )
    .await
    .expect("init_extra_account_meta_list");

    mint_kp
}

pub fn settle_pda_keys(merkle_tree: &Pubkey) -> (Pubkey, Pubkey, Pubkey) {
    let (registry_key, _) = super::instructions::registry_pda();
    let (tree_creator_key, _) = super::instructions::tree_creator_pda();
    let tree_config_key =
        zksettle::instructions::bubblegum_mint::tree_config_pda(merkle_tree).0;
    (registry_key, tree_creator_key, tree_config_key)
}
