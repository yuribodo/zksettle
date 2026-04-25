use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::convert::{fr_to_bytes_be, wallet_hex_to_bytes};
use crate::error::ServiceError;
use crate::state::SharedState;

#[derive(Serialize)]
pub struct MembershipProofResponse {
    pub wallet: String,
    pub leaf_index: usize,
    pub path: Vec<String>,
    pub path_indices: Vec<u8>,
    pub root: String,
}

pub async fn handler(
    State(state): State<SharedState>,
    Path(wallet): Path<String>,
) -> Result<Json<MembershipProofResponse>, ServiceError> {
    let wallet_bytes = wallet_hex_to_bytes(&wallet)?;
    let st = state.read().await;

    let cred = st
        .credentials
        .get(&wallet_bytes)
        .ok_or(ServiceError::WalletNotFound)?;

    if cred.revoked {
        return Err(ServiceError::WalletRevoked);
    }

    let proof = st.membership_tree.proof(cred.leaf_index)?;
    let root = st.membership_tree.root();

    Ok(Json(MembershipProofResponse {
        wallet,
        leaf_index: cred.leaf_index,
        path: proof.path.iter().map(|f| hex::encode(fr_to_bytes_be(f))).collect(),
        path_indices: proof.path_indices.to_vec(),
        root: hex::encode(fr_to_bytes_be(&root)),
    }))
}
