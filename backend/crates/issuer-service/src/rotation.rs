use std::sync::Arc;
use std::time::Duration;

use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use tokio::sync::watch;
use zksettle_rpc::SolanaRpc;

use crate::chain;
use crate::state::{PublishLock, SharedState};

pub fn spawn(
    state: SharedState,
    rpc: Arc<dyn SolanaRpc>,
    keypair: Keypair,
    program_id: Pubkey,
    interval_secs: u64,
    mut shutdown: watch::Receiver<()>,
    publish_lock: PublishLock,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let interval = Duration::from_secs(interval_secs);
        let keypair_bytes = keypair.to_bytes().to_vec();
        loop {
            tokio::select! {
                _ = tokio::time::sleep(interval) => {}
                _ = shutdown.changed() => {
                    tracing::info!("rotation task shutting down");
                    return;
                }
            }
            publish_roots(&state, rpc.clone(), &keypair_bytes, &program_id, &publish_lock).await;
        }
    })
}

#[mutants::skip]
async fn publish_roots(
    state: &SharedState,
    rpc: Arc<dyn SolanaRpc>,
    keypair_bytes: &[u8],
    program_id: &Pubkey,
    publish_lock: &PublishLock,
) {
    let _guard = publish_lock.lock().await;

    let (mr, sr, jr, was_registered) = {
        let st = state.read().await;
        if !st.roots_dirty && st.registered {
            tracing::debug!("roots unchanged, skipping rotation publish");
            return;
        }
        let roots = st.roots_as_bytes();
        (roots.0, roots.1, roots.2, st.registered)
    };

    let kb = keypair_bytes.to_vec();
    let pid = *program_id;

    let result = tokio::task::spawn_blocking(move || {
        chain::publish_roots(rpc.as_ref(), &kb, &pid, mr, sr, jr, was_registered)
    })
    .await;

    match result {
        Ok(Ok(pr)) => {
            let mut st = state.write().await;
            if pr.did_register && !st.registered {
                st.registered = true;
                tracing::info!(slot = pr.slot, "issuer registered on-chain");
            } else {
                tracing::info!(slot = pr.slot, "roots published on-chain");
            }
            st.last_publish_slot = pr.slot;
            st.roots_dirty = false;
        }
        Ok(Err(e)) => {
            tracing::error!(%e, "failed to publish roots");
        }
        Err(e) => {
            tracing::error!(%e, "publish task panicked");
        }
    }
}
