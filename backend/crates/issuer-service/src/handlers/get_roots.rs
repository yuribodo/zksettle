use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::state::SharedState;

#[derive(Serialize)]
pub struct RootsResponse {
    pub membership_root: String,
    pub sanctions_root: String,
    pub jurisdiction_root: String,
    pub last_publish_slot: u64,
    pub wallet_count: usize,
}

pub async fn handler(State(state): State<SharedState>) -> Json<RootsResponse> {
    let st = state.read().await;
    let (mr, sr, jr) = st.roots_as_bytes();

    Json(RootsResponse {
        membership_root: hex::encode(mr),
        sanctions_root: hex::encode(sr),
        jurisdiction_root: hex::encode(jr),
        last_publish_slot: st.last_publish_slot,
        wallet_count: st.wallet_count(),
    })
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use tokio::sync::RwLock;

    use super::*;
    use crate::convert::wallet_to_fr;
    use crate::state::{CredentialRecord, IssuerState};

    fn shared_state(state: IssuerState) -> SharedState {
        Arc::new(RwLock::new(state))
    }

    #[tokio::test]
    async fn empty_state_returns_zeroed_roots_and_no_wallets() {
        let state = shared_state(IssuerState::new());
        let body = handler(State(state)).await.0;

        assert_eq!(body.wallet_count, 0);
        assert_eq!(body.last_publish_slot, 0);
        // 32-byte hex encodes to 64 chars
        assert_eq!(body.membership_root.len(), 64);
        assert_eq!(body.sanctions_root.len(), 64);
        assert_eq!(body.jurisdiction_root.len(), 64);
    }

    #[tokio::test]
    async fn wallet_count_reflects_inserted_credentials() {
        let mut st = IssuerState::new();
        let wallet_hex = format!("0x{}", hex::encode([1u8; 32]));
        st.membership_tree.insert(wallet_to_fr(&wallet_hex).unwrap());
        st.credentials.insert(
            [1u8; 32],
            CredentialRecord {
                wallet: [1u8; 32],
                leaf_index: 0,
                jurisdiction: "US".into(),
                issued_at: 1,
                revoked: false,
            },
        );
        st.last_publish_slot = 1234;

        let body = handler(State(shared_state(st))).await.0;
        assert_eq!(body.wallet_count, 1);
        assert_eq!(body.last_publish_slot, 1234);
    }

    #[tokio::test]
    async fn membership_root_changes_after_insert() {
        let empty_body = handler(State(shared_state(IssuerState::new()))).await.0;

        let mut st = IssuerState::new();
        st.membership_tree
            .insert(wallet_to_fr(&format!("0x{}", hex::encode([9u8; 32]))).unwrap());
        let inserted_body = handler(State(shared_state(st))).await.0;

        assert_ne!(empty_body.membership_root, inserted_body.membership_root);
    }
}
