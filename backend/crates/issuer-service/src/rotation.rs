use std::time::Duration;

use solana_rpc_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use tokio::sync::watch;

use crate::chain;
use crate::state::SharedState;

pub fn spawn(
    state: SharedState,
    rpc_url: String,
    keypair: Keypair,
    program_id: Pubkey,
    interval_secs: u64,
    mut shutdown: watch::Receiver<()>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let interval = Duration::from_secs(interval_secs);
        loop {
            tokio::select! {
                _ = tokio::time::sleep(interval) => {}
                _ = shutdown.changed() => {
                    tracing::info!("rotation task shutting down");
                    return;
                }
            }
            publish_roots(&state, &rpc_url, &keypair, &program_id).await;
        }
    })
}

async fn publish_roots(
    state: &SharedState,
    rpc_url: &str,
    keypair: &Keypair,
    program_id: &Pubkey,
) {
    let rpc = RpcClient::new(rpc_url.to_string());
    let mut st = state.write().await;

    let (mr, sr, jr) = st.roots_as_bytes();

    let result = if !st.registered {
        chain::register_issuer(&rpc, keypair, program_id, mr, sr, jr)
    } else {
        chain::update_issuer_root(&rpc, keypair, program_id, mr, sr, jr)
    };

    match result {
        Ok(slot) => {
            if !st.registered {
                st.registered = true;
                tracing::info!(slot, "issuer registered on-chain");
            } else {
                tracing::info!(slot, "roots published on-chain");
            }
            st.last_publish_slot = slot;
        }
        Err(e) => {
            tracing::error!(%e, "failed to publish roots");
        }
    }
}
