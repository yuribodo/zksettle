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

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use tokio::sync::RwLock;

    use super::*;
    use crate::state::IssuerState;

    fn state_with(wallet: [u8; 32]) -> SharedState {
        let mut st = IssuerState::new();
        st.credentials.insert(
            wallet,
            CredentialRecord {
                wallet,
                leaf_index: 0,
                jurisdiction: "US".into(),
                issued_at: 1234,
                revoked: false,
            },
        );
        Arc::new(RwLock::new(st))
    }

    #[tokio::test]
    async fn returns_credential_for_known_wallet() {
        let wallet = [7u8; 32];
        let state = state_with(wallet);
        let hex = format!("0x{}", hex::encode(wallet));

        let resp = handler(State(state), Path(hex)).await.unwrap();
        assert_eq!(resp.0.wallet, wallet);
        assert_eq!(resp.0.jurisdiction, "US");
    }

    #[tokio::test]
    async fn missing_wallet_returns_wallet_not_found() {
        let state = state_with([7u8; 32]);
        let other = format!("0x{}", hex::encode([99u8; 32]));

        let err = handler(State(state), Path(other)).await.unwrap_err();
        assert!(matches!(err, ServiceError::WalletNotFound));
    }

    #[tokio::test]
    async fn invalid_hex_returns_invalid_hex() {
        let state = state_with([7u8; 32]);
        let err = handler(State(state), Path("not-hex".into())).await.unwrap_err();
        assert!(matches!(err, ServiceError::InvalidHex(_)));
    }
}
