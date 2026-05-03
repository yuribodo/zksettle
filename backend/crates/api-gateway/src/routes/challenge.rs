use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
pub struct ChallengeResponse {
    pub nonce: String,
}

pub async fn get_challenge(
    State(state): State<Arc<AppState>>,
) -> Json<ChallengeResponse> {
    let nonce = state.nonce_store.issue();
    Json(ChallengeResponse { nonce })
}
