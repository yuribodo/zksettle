use axum::extract::{Path, State};
use axum::Json;

use crate::convert::wallet_hex_to_bytes;
use crate::error::ServiceError;
use crate::state::{CredentialRecord, SharedState};

pub async fn handler(
    State(state): State<SharedState>,
    Path(wallet): Path<String>,
) -> Result<Json<CredentialRecord>, ServiceError> {
    let wallet_bytes = wallet_hex_to_bytes(&wallet)?;
    let st = state.read().await;
    st.credentials
        .get(&wallet_bytes)
        .cloned()
        .map(Json)
        .ok_or(ServiceError::WalletNotFound)
}
