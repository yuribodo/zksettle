#![cfg(feature = "light-tests")]
//! Smoke test for the Light Protocol migration.
//!
//! Boots a `LightProgramTest` harness with the compiled `zksettle.so` and
//! verifies that the program loads. Intentionally minimal — full end-to-end
//! coverage of `verify_proof` + `check_attestation` lives in future work
//! once the gnark proof fixtures are wired into the Light harness.
//!
//! Run with:
//!
//! ```bash
//! cargo test --features light-tests -- --nocapture
//! ```
//!
//! Requires a running prover server; see the light-program-test README.

use light_program_test::{LightProgramTest, ProgramTestConfig, Rpc};
use solana_sdk::signer::{keypair::Keypair, Signer};

#[tokio::test]
async fn harness_boots_with_zksettle_program() {
    let config = ProgramTestConfig::new_v2(false, Some(vec![("zksettle", zksettle::ID)]));
    let mut rpc = LightProgramTest::new(config).await.expect("boot light harness");

    let payer = Keypair::new();
    rpc.airdrop_lamports(&payer.pubkey(), 1_000_000_000)
        .await
        .expect("airdrop");

    let _ = rpc.get_address_tree_v2();
    let _ = rpc.get_random_state_tree_info();
}
