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

#[derive(Serialize)]
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
