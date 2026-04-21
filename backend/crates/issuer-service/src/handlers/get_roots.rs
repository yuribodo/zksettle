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
