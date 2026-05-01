use axum::extract::State;
use axum::Json;

use crate::auth::WalletAuth;
use crate::error::ServiceError;
use crate::state::{CredentialRecord, SharedState};

pub async fn handler(
    State(state): State<SharedState>,
    wallet_auth: WalletAuth,
) -> Result<Json<CredentialRecord>, ServiceError> {
    let st = state.read().await;
    st.credentials
        .get(&wallet_auth.wallet_bytes)
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

    fn auth(wallet: [u8; 32]) -> WalletAuth {
        WalletAuth {
            wallet_hex: format!("0x{}", hex::encode(wallet)),
            wallet_bytes: wallet,
        }
    }

    #[tokio::test]
    async fn returns_credential_for_known_wallet() {
        let wallet = [7u8; 32];
        let state = state_with(wallet);

        let resp = handler(State(state), auth(wallet)).await.unwrap();
        assert_eq!(resp.0.wallet, wallet);
        assert_eq!(resp.0.jurisdiction, "US");
    }

    #[tokio::test]
    async fn missing_wallet_returns_wallet_not_found() {
        let state = state_with([7u8; 32]);

        let err = handler(State(state), auth([99u8; 32])).await.unwrap_err();
        assert!(matches!(err, ServiceError::WalletNotFound));
    }
}
