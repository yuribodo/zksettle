use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::convert::{wallet_hex_to_bytes, wallet_to_fr};
use crate::error::ServiceError;
use crate::state::SharedState;

#[derive(Debug, Serialize)]
pub struct RevokeResponse {
    pub wallet: String,
    pub revoked: bool,
}

pub async fn handler(
    State(state): State<SharedState>,
    axum::Extension(crate::StatePath(state_path)): axum::Extension<crate::StatePath>,
    Path(wallet): Path<String>,
) -> Result<Json<RevokeResponse>, ServiceError> {
    let wallet_bytes = wallet_hex_to_bytes(&wallet)?;
    let wallet_fr = wallet_to_fr(&wallet)?;
    let mut st = state.write().await;

    let cred = st
        .credentials
        .get(&wallet_bytes)
        .ok_or(ServiceError::WalletNotFound)?;

    if cred.revoked {
        return Err(ServiceError::AlreadyRevoked);
    }

    let leaf_index = cred.leaf_index;
    let prev_roots_dirty = st.roots_dirty;

    st.membership_tree
        .zero_leaf(leaf_index)
        .map_err(ServiceError::from)?;

    let removed_from_sanctions = st.sanctions_tree.remove(wallet_fr);
    if !removed_from_sanctions {
        tracing::debug!(%wallet, "wallet was not in sanctions tree");
    }

    st.credentials
        .get_mut(&wallet_bytes)
        .expect("checked above")
        .revoked = true;

    st.roots_dirty = true;

    if let Some(ref path) = state_path {
        if let Err(e) = crate::persist::save(path, &st) {
            if let Err(e) = st.membership_tree.set_leaf(leaf_index, wallet_fr) {
                tracing::error!(%e, "rollback set_leaf failed, state may be inconsistent");
            }
            if removed_from_sanctions {
                st.sanctions_tree.insert(wallet_fr);
            }
            st.credentials
                .get_mut(&wallet_bytes)
                .expect("checked above")
                .revoked = false;
            st.roots_dirty = prev_roots_dirty;
            return Err(e);
        }
    }

    Ok(Json(RevokeResponse {
        wallet,
        revoked: true,
    }))
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use tokio::sync::RwLock;

    use super::*;
    use crate::state::{CredentialRecord, IssuerState};
    use crate::StatePath;

    fn empty_state_path() -> axum::Extension<StatePath> {
        axum::Extension(StatePath(None))
    }

    fn state_with_wallet(wallet: [u8; 32], revoked: bool) -> SharedState {
        let mut st = IssuerState::new();
        st.membership_tree
            .insert(wallet_to_fr(&format!("0x{}", hex::encode(wallet))).unwrap());
        st.credentials.insert(
            wallet,
            CredentialRecord {
                wallet,
                leaf_index: 0,
                jurisdiction: "US".into(),
                issued_at: 0,
                revoked,
            },
        );
        Arc::new(RwLock::new(st))
    }

    #[tokio::test]
    async fn happy_path_marks_revoked_and_flips_dirty() {
        let wallet = [1u8; 32];
        let state = state_with_wallet(wallet, false);
        let hex = format!("0x{}", hex::encode(wallet));

        let resp = handler(State(state.clone()), empty_state_path(), Path(hex.clone()))
            .await
            .unwrap()
            .0;

        assert!(resp.revoked);
        let st = state.read().await;
        assert!(st.credentials[&wallet].revoked);
        assert!(st.roots_dirty);
    }

    #[tokio::test]
    async fn missing_wallet_returns_wallet_not_found() {
        let state: SharedState = Arc::new(RwLock::new(IssuerState::new()));
        let hex = format!("0x{}", hex::encode([99u8; 32]));
        let err = handler(State(state), empty_state_path(), Path(hex))
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::WalletNotFound));
    }

    #[tokio::test]
    async fn already_revoked_returns_conflict() {
        let wallet = [2u8; 32];
        let state = state_with_wallet(wallet, true);
        let hex = format!("0x{}", hex::encode(wallet));
        let err = handler(State(state), empty_state_path(), Path(hex))
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::AlreadyRevoked));
    }

    #[tokio::test]
    async fn invalid_hex_returns_invalid_hex() {
        let state: SharedState = Arc::new(RwLock::new(IssuerState::new()));
        let err = handler(State(state), empty_state_path(), Path("bad".into()))
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::InvalidHex(_)));
    }
}
