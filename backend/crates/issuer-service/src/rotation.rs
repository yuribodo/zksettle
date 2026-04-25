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

#[cfg(test)]
mod tests {
    use tokio::sync::{Mutex, RwLock};
    use zksettle_rpc::{MockSolanaRpc, RpcError};

    use super::*;
    use crate::state::IssuerState;

    fn fixture(
        roots_dirty: bool,
        registered: bool,
    ) -> (SharedState, Arc<MockSolanaRpc>, Vec<u8>, Pubkey, PublishLock) {
        let mut st = IssuerState::new();
        st.roots_dirty = roots_dirty;
        st.registered = registered;
        let kp = Keypair::new();
        (
            Arc::new(RwLock::new(st)),
            Arc::new(MockSolanaRpc::new()),
            kp.to_bytes().to_vec(),
            Pubkey::new_unique(),
            Arc::new(Mutex::new(())),
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn dirty_roots_trigger_publish_and_clear_dirty() {
        let (state, rpc, kb, pid, lock) = fixture(true, false);
        let rpc_dyn: Arc<dyn SolanaRpc> = rpc.clone();

        publish_roots(&state, rpc_dyn, &kb, &pid, &lock).await;

        assert_eq!(rpc.send_count(), 1);
        let st = state.read().await;
        assert!(st.registered, "first publish flips registered");
        assert!(!st.roots_dirty, "publish clears roots_dirty");
        assert!(st.last_publish_slot >= 1_000);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn clean_roots_when_registered_skips_publish() {
        let (state, rpc, kb, pid, lock) = fixture(false, true);
        let rpc_dyn: Arc<dyn SolanaRpc> = rpc.clone();

        publish_roots(&state, rpc_dyn, &kb, &pid, &lock).await;

        assert_eq!(rpc.send_count(), 0, "must not publish when nothing changed");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn clean_roots_when_unregistered_still_publishes_to_register() {
        let (state, rpc, kb, pid, lock) = fixture(false, false);
        let rpc_dyn: Arc<dyn SolanaRpc> = rpc.clone();

        publish_roots(&state, rpc_dyn, &kb, &pid, &lock).await;

        assert_eq!(rpc.send_count(), 1, "must register even with clean roots");
        assert!(state.read().await.registered);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn rpc_failure_does_not_mutate_state() {
        let (state, rpc, kb, pid, lock) = fixture(true, false);
        rpc.queue_error(RpcError::Call("simulated".into()));
        let rpc_dyn: Arc<dyn SolanaRpc> = rpc.clone();

        publish_roots(&state, rpc_dyn, &kb, &pid, &lock).await;

        let st = state.read().await;
        assert!(!st.registered, "failed RPC must not flip registered");
        assert!(st.roots_dirty, "failed RPC must keep roots_dirty for retry");
        assert_eq!(st.last_publish_slot, 0);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn shutdown_signal_terminates_spawn_loop_quickly() {
        // Sanity check on spawn(): with a long interval, sending shutdown
        // before the first sleep elapses still terminates the task.
        let (state, rpc, _kb, pid, lock) = fixture(true, false);
        let kp = Keypair::new();
        let (tx, rx) = watch::channel(());

        let handle = spawn(state, rpc.clone(), kp, pid, 3600, rx, lock);

        tokio::time::sleep(Duration::from_millis(50)).await;
        let _ = tx.send(());

        let join_result =
            tokio::time::timeout(Duration::from_secs(2), handle).await;
        assert!(join_result.is_ok(), "rotation task must exit on shutdown");
    }
}
