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

#[derive(Serialize)]
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
