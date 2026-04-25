use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::convert::{fr_to_bytes_be, wallet_hex_to_bytes, wallet_to_fr};
use crate::error::ServiceError;
use crate::state::SharedState;

#[derive(Serialize)]
pub struct SanctionsProofResponse {
    pub wallet: String,
    pub path: Vec<String>,
    pub path_indices: Vec<u8>,
    pub leaf_value: String,
    pub root: String,
}

pub async fn handler(
    State(state): State<SharedState>,
    Path(wallet): Path<String>,
) -> Result<Json<SanctionsProofResponse>, ServiceError> {
    let wallet_bytes = wallet_hex_to_bytes(&wallet)?;
    let wallet_fr = wallet_to_fr(&wallet)?;
    let st = state.read().await;

    if let Some(cred) = st.credentials.get(&wallet_bytes) {
        if cred.revoked {
            return Err(ServiceError::WalletRevoked);
        }
    }

    let proof = st.sanctions_tree.exclusion_proof(wallet_fr)?;
    let root = st.sanctions_tree.root();

    Ok(Json(SanctionsProofResponse {
        wallet,
        path: proof.path.iter().map(|f| hex::encode(fr_to_bytes_be(f))).collect(),
        path_indices: proof.path_indices.to_vec(),
        leaf_value: hex::encode(fr_to_bytes_be(&proof.leaf_value)),
        root: hex::encode(fr_to_bytes_be(&root)),
    }))
}
