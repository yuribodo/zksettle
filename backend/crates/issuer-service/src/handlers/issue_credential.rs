use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::convert::{wallet_hex_to_bytes, wallet_to_fr};
use crate::error::ServiceError;
use crate::state::{CredentialRecord, SharedState};

#[derive(Deserialize)]
pub struct IssueRequest {
    pub wallet: String,
    #[serde(default = "default_jurisdiction")]
    pub jurisdiction: String,
}

fn default_jurisdiction() -> String {
    "US".to_string()
}

#[derive(Debug, Serialize)]
pub struct IssueResponse {
    pub wallet: String,
    pub leaf_index: usize,
    pub jurisdiction: String,
}

pub async fn handler(
    State(state): State<SharedState>,
    axum::Extension(crate::StatePath(state_path)): axum::Extension<crate::StatePath>,
    Json(req): Json<IssueRequest>,
) -> Result<Json<IssueResponse>, ServiceError> {
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
        CredentialRecord {
            wallet: wallet_bytes,
            leaf_index,
            jurisdiction: req.jurisdiction.clone(),
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

    Ok(Json(IssueResponse {
        wallet: req.wallet,
        leaf_index,
        jurisdiction: req.jurisdiction,
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

    #[test]
    fn default_jurisdiction_is_us() {
        assert_eq!(default_jurisdiction(), "US");
    }

    #[tokio::test]
    async fn happy_path_inserts_with_provided_jurisdiction() {
        let state: SharedState = Arc::new(RwLock::new(IssuerState::new()));
        let hex = format!("0x{}", hex::encode([1u8; 32]));

        let resp = handler(
            State(state.clone()),
            empty_state_path(),
            Json(IssueRequest {
                wallet: hex.clone(),
                jurisdiction: "BR".into(),
            }),
        )
        .await
        .unwrap()
        .0;

        assert_eq!(resp.jurisdiction, "BR");
        assert_eq!(resp.leaf_index, 0);
        let st = state.read().await;
        assert_eq!(st.credentials[&[1u8; 32]].jurisdiction, "BR");
        assert!(st.roots_dirty);
    }

    #[tokio::test]
    async fn second_credential_gets_next_leaf_index() {
        let state: SharedState = Arc::new(RwLock::new(IssuerState::new()));

        for (i, byte) in [1u8, 2u8].iter().enumerate() {
            let resp = handler(
                State(state.clone()),
                empty_state_path(),
                Json(IssueRequest {
                    wallet: format!("0x{}", hex::encode([*byte; 32])),
                    jurisdiction: "US".into(),
                }),
            )
            .await
            .unwrap()
            .0;
            assert_eq!(resp.leaf_index, i);
        }
    }

    #[tokio::test]
    async fn duplicate_wallet_returns_conflict() {
        let state: SharedState = Arc::new(RwLock::new(IssuerState::new()));
        let hex = format!("0x{}", hex::encode([3u8; 32]));

        handler(
            State(state.clone()),
            empty_state_path(),
            Json(IssueRequest {
                wallet: hex.clone(),
                jurisdiction: "US".into(),
            }),
        )
        .await
        .unwrap();

        let err = handler(
            State(state),
            empty_state_path(),
            Json(IssueRequest {
                wallet: hex,
                jurisdiction: "US".into(),
            }),
        )
        .await
        .unwrap_err();
        assert!(matches!(err, ServiceError::DuplicateWallet));
    }

    #[tokio::test]
    async fn invalid_hex_returns_invalid_hex() {
        let state: SharedState = Arc::new(RwLock::new(IssuerState::new()));
        let err = handler(
            State(state),
            empty_state_path(),
            Json(IssueRequest {
                wallet: "bad-hex".into(),
                jurisdiction: "US".into(),
            }),
        )
        .await
        .unwrap_err();
        assert!(matches!(err, ServiceError::InvalidHex(_)));
    }
}
