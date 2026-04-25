use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::convert::{wallet_hex_to_bytes, wallet_to_fr};
use crate::error::ServiceError;
use crate::state::SharedState;

#[derive(Deserialize)]
pub struct AddWalletRequest {
    pub wallet: String,
}

#[derive(Debug, Serialize)]
pub struct AddWalletResponse {
    pub wallet: String,
    pub message: &'static str,
}

pub async fn handler(
    State(state): State<SharedState>,
    axum::Extension(crate::StatePath(state_path)): axum::Extension<crate::StatePath>,
    Json(req): Json<AddWalletRequest>,
) -> Result<Json<AddWalletResponse>, ServiceError> {
    let wallet_bytes = wallet_hex_to_bytes(&req.wallet)?;
    let wallet_fr = wallet_to_fr(&req.wallet)?;

    let mut st = state.write().await;
    if st.credentials.contains_key(&wallet_bytes) {
        return Err(ServiceError::DuplicateWallet);
    }
    st.membership_tree.insert(wallet_fr);
    st.roots_dirty = true;
    let leaf_index = st.credentials.len();
    st.credentials.insert(
        wallet_bytes,
        crate::state::CredentialRecord {
            wallet: wallet_bytes,
            leaf_index,
            jurisdiction: "UNKNOWN".to_string(),
            issued_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            revoked: false,
        },
    );

    if let Some(ref path) = state_path {
        crate::persist::save(path, &st)?;
    }

    Ok(Json(AddWalletResponse {
        wallet: req.wallet,
        message: "added to membership tree",
    }))
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use tokio::sync::RwLock;

    use super::*;
    use crate::state::IssuerState;
    use crate::StatePath;

    fn empty_state_path() -> axum::Extension<StatePath> {
        axum::Extension(StatePath(None))
    }

    #[tokio::test]
    async fn happy_path_inserts_credential_and_marks_dirty() {
        let state: SharedState = Arc::new(RwLock::new(IssuerState::new()));
        let hex = format!("0x{}", hex::encode([1u8; 32]));

        let resp = handler(
            State(state.clone()),
            empty_state_path(),
            Json(AddWalletRequest { wallet: hex.clone() }),
        )
        .await
        .unwrap()
        .0;

        assert_eq!(resp.wallet, hex);
        let st = state.read().await;
        assert_eq!(st.credentials.len(), 1);
        assert!(st.credentials.contains_key(&[1u8; 32]));
        assert!(st.roots_dirty, "insertion must flag roots_dirty");
        assert_eq!(st.credentials[&[1u8; 32]].jurisdiction, "UNKNOWN");
    }

    #[tokio::test]
    async fn duplicate_wallet_returns_conflict_and_does_not_double_insert() {
        let state: SharedState = Arc::new(RwLock::new(IssuerState::new()));
        let hex = format!("0x{}", hex::encode([2u8; 32]));

        let _ = handler(
            State(state.clone()),
            empty_state_path(),
            Json(AddWalletRequest { wallet: hex.clone() }),
        )
        .await
        .unwrap();

        let err = handler(
            State(state.clone()),
            empty_state_path(),
            Json(AddWalletRequest { wallet: hex }),
        )
        .await
        .unwrap_err();
        assert!(matches!(err, ServiceError::DuplicateWallet));
        assert_eq!(state.read().await.credentials.len(), 1);
    }

    #[tokio::test]
    async fn invalid_hex_returns_invalid_hex() {
        let state: SharedState = Arc::new(RwLock::new(IssuerState::new()));
        let err = handler(
            State(state),
            empty_state_path(),
            Json(AddWalletRequest { wallet: "bad-hex".into() }),
        )
        .await
        .unwrap_err();
        assert!(matches!(err, ServiceError::InvalidHex(_)));
    }
}
