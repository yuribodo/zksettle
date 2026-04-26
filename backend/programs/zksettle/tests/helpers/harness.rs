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

pub fn nonzero_nullifier() -> [u8; 32] {
    let mut n = [0u8; 32];
    n[0] = 1;
    n
}
