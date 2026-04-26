use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::chain;
use crate::error::ServiceError;
use crate::state::{PublishLock, SharedState};
use crate::{KeypairBytes, ProgramId, SharedRpc};

#[derive(Debug, Serialize)]
pub struct PublishResponse {
    pub slot: u64,
    pub registered: bool,
}

#[mutants::skip]
pub async fn handler(
    State(state): State<SharedState>,
    axum::Extension(SharedRpc(rpc)): axum::Extension<SharedRpc>,
    axum::Extension(KeypairBytes(keypair_bytes)): axum::Extension<KeypairBytes>,
    axum::Extension(ProgramId(program_id)): axum::Extension<ProgramId>,
    axum::Extension(publish_lock): axum::Extension<PublishLock>,
) -> Result<Json<PublishResponse>, ServiceError> {
    let _guard = publish_lock.lock().await;

    let (mr, sr, jr, was_registered) = {
        let st = state.read().await;
        if !st.roots_dirty && st.registered {
            return Ok(Json(PublishResponse {
                slot: st.last_publish_slot,
                registered: true,
            }));
        }
        let roots = st.roots_as_bytes();
        (roots.0, roots.1, roots.2, st.registered)
    };

    let result = tokio::task::spawn_blocking(move || {
        chain::publish_roots(
            rpc.as_ref(),
            &keypair_bytes,
            &program_id,
            mr,
            sr,
            jr,
            was_registered,
        )
    })
    .await
    .map_err(|e| ServiceError::Chain(e.to_string()))??;

    let mut st = state.write().await;
    if result.did_register && !st.registered {
        st.registered = true;
    }
    st.last_publish_slot = result.slot;
    st.roots_dirty = false;
    let registered = st.registered;

    Ok(Json(PublishResponse {
        slot: result.slot,
        registered,
    }))
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use solana_sdk::pubkey::Pubkey;
    use solana_sdk::signature::Keypair;
    use tokio::sync::{Mutex, RwLock};
    use zksettle_rpc::{MockSolanaRpc, RpcError, SolanaRpc};

    use super::*;
    use crate::state::IssuerState;

    struct Harness {
        state: SharedState,
        rpc: Arc<MockSolanaRpc>,
        keypair_bytes: Vec<u8>,
        program_id: Pubkey,
        publish_lock: PublishLock,
    }

    impl Harness {
        fn new() -> Self {
            let kp = Keypair::new();
            Self {
                state: Arc::new(RwLock::new(IssuerState::new())),
                rpc: Arc::new(MockSolanaRpc::new()),
                keypair_bytes: kp.to_bytes().to_vec(),
                program_id: Pubkey::new_unique(),
                publish_lock: Arc::new(Mutex::new(())),
            }
        }

        async fn call(&self) -> Result<Json<PublishResponse>, ServiceError> {
            let rpc_dyn: Arc<dyn SolanaRpc> = self.rpc.clone();
            handler(
                State(self.state.clone()),
                axum::Extension(SharedRpc(rpc_dyn)),
                axum::Extension(KeypairBytes(self.keypair_bytes.clone())),
                axum::Extension(ProgramId(self.program_id)),
                axum::Extension(self.publish_lock.clone()),
            )
            .await
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn first_publish_sends_register_tx_and_marks_registered() {
        let h = Harness::new();
        h.state.write().await.roots_dirty = true;

        let resp = h.call().await.unwrap().0;

        assert!(resp.registered);
        assert!(resp.slot >= 1_000, "MockSolanaRpc starts slot at 1_000");
        assert_eq!(h.rpc.send_count(), 1);
        let st = h.state.read().await;
        assert!(st.registered);
        assert!(!st.roots_dirty, "publish must clear roots_dirty");
        assert_eq!(st.last_publish_slot, resp.slot);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn already_registered_clean_roots_short_circuits_without_rpc() {
        let h = Harness::new();
        {
            let mut st = h.state.write().await;
            st.registered = true;
            st.roots_dirty = false;
            st.last_publish_slot = 42;
        }

        let resp = h.call().await.unwrap().0;
        assert!(resp.registered);
        assert_eq!(resp.slot, 42);
        assert_eq!(
            h.rpc.send_count(),
            0,
            "must not call RPC when nothing changed"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn rpc_failure_propagates_as_chain_error() {
        let h = Harness::new();
        h.state.write().await.roots_dirty = true;
        h.rpc
            .queue_error(RpcError::Call("simulated rpc down".into()));

        let err = h.call().await.unwrap_err();
        assert!(matches!(err, ServiceError::Chain(_)));
        let st = h.state.read().await;
        assert!(!st.registered, "failed publish must not flip registered");
        assert!(st.roots_dirty, "failed publish must keep roots_dirty");
    }
}
