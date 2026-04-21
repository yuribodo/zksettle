#![cfg(feature = "light-tests")]
//! Smoke skeleton for the Token-2022 `transfer_hook` path post-Light migration.
//!
//! Boots the `LightProgramTest` harness with compiled `zksettle.so` and
//! documents the shape of the end-to-end flow. The body stays `#[ignore]`
//! until we have gnark proof/witness fixtures bound to a real
//! (mint, epoch, recipient, amount) tuple plus a Token-2022 mint with the
//! hook configured.
//!
//! Flow under test (per ADR-020 + ADR-022):
//!
//! 1. `register_issuer(merkle_root)` — issuer PDA.
//! 2. `init_extra_account_meta_list(mint)` — hook extra-accounts config.
//! 3. `set_hook_payload(proof_and_witness, nullifier_hash, mint, epoch,
//!    recipient, amount)` — writes payload PDA bound to the tx tuple.
//! 4. `transfer_hook(amount, validity_proof, address_tree_info,
//!    output_state_tree_index)` — invoked by Token-2022 Execute; binds
//!    payload to live tx, runs `verify_bundle`, inserts compressed
//!    `Nullifier` + `Attestation` via Light CPI, closes payload to owner.
//! 5. Replay with same `nullifier_hash` fails at the Light CPI create-address
//!    step (Poseidon(sk, mint, epoch, recipient, amount) collision).
//!
//! Run with:
//!
//! ```bash
//! cargo test --features light-tests --test transfer_hook_smoke -- --ignored --nocapture
//! ```
//!
//! Requires a running prover server and compiled `zksettle.so`.

use light_program_test::{LightProgramTest, ProgramTestConfig};

async fn boot_harness() -> LightProgramTest {
    let config = ProgramTestConfig::new_v2(false, Some(vec![("zksettle", zksettle::ID)]));
    LightProgramTest::new(config).await.expect("boot light harness")
}

#[tokio::test]
#[ignore = "requires gnark fixture + Token-2022 mint with hook configured"]
async fn transfer_hook_settles_and_blocks_replay() {
    let _rpc = boot_harness().await;
    // TODO(ADR-006 follow-up):
    // - build Token-2022 mint with TransferHook extension pointing at zksettle
    // - load gnark proof + witness fixture for (mint, epoch, recipient, amount)
    // - run set_hook_payload then a Token-2022 transfer that triggers the hook
    // - assert Light attestation account + ProofSettled event (9 fields)
    // - replay same payload, assert address-collision error from Light CPI
}
