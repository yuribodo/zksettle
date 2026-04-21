use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::convert::wallet_to_fr;
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
    Json(req): Json<AddWalletRequest>,
) -> Result<Json<AddWalletResponse>, ServiceError> {
    let wallet_fr = wallet_to_fr(&req.wallet)?;

    let mut st = state.write().await;
    st.membership_tree.insert(wallet_fr);

    Ok(Json(AddWalletResponse {
        wallet: req.wallet,
        message: "added to membership tree",
    }))
}
