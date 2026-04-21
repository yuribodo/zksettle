use light_program_test::{LightProgramTest, ProgramTestConfig, Rpc};
use solana_keypair::Keypair;
use solana_signer::Signer;

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
