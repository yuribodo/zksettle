use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::auth::WalletAuth;
use crate::convert::{fr_to_bytes_be, wallet_to_fr};
use crate::error::ServiceError;
use crate::state::SharedState;

#[derive(Debug, Serialize)]
pub struct SanctionsProofResponse {
    pub wallet: String,
    pub path: Vec<String>,
    pub path_indices: Vec<u8>,
    pub leaf_value: String,
    pub root: String,
}

pub async fn handler(
    State(state): State<SharedState>,
    wallet_auth: WalletAuth,
) -> Result<Json<SanctionsProofResponse>, ServiceError> {
    let wallet_fr = wallet_to_fr(&wallet_auth.wallet_hex)?;
    let st = state.read().await;

    if let Some(cred) = st.credentials.get(&wallet_auth.wallet_bytes) {
        if cred.revoked {
            return Err(ServiceError::WalletRevoked);
        }
    }

    let proof = st.sanctions_tree.exclusion_proof(wallet_fr)?;
    let root = st.sanctions_tree.root();

    Ok(Json(SanctionsProofResponse {
        wallet: wallet_auth.wallet_hex,
        path: proof
            .path
            .iter()
            .map(|f| hex::encode(fr_to_bytes_be(f)))
            .collect(),
        path_indices: proof.path_indices.to_vec(),
        leaf_value: hex::encode(fr_to_bytes_be(&proof.leaf_value)),
        root: hex::encode(fr_to_bytes_be(&root)),
    }))
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use ark_ff::AdditiveGroup;
    use tokio::sync::RwLock;

    use super::*;
    use crate::auth::WalletAuth;
    use crate::state::{CredentialRecord, IssuerState};

    fn auth(wallet: [u8; 32]) -> WalletAuth {
        WalletAuth {
            wallet_hex: format!("0x{}", hex::encode(wallet)),
            wallet_bytes: wallet,
        }
    }

    #[tokio::test]
    async fn clean_wallet_yields_zero_leaf_exclusion_proof() {
        let state = Arc::new(RwLock::new(IssuerState::new()));
        let wallet = [5u8; 32];
        let wallet_hex = format!("0x{}", hex::encode(wallet));

        let resp = handler(State(state), auth(wallet)).await.unwrap().0;

        let leaf_bytes = hex::decode(&resp.leaf_value).unwrap();
        assert_eq!(leaf_bytes, fr_to_bytes_be(&ark_bn254::Fr::ZERO));
        assert_eq!(resp.wallet, wallet_hex);
    }

    #[tokio::test]
    async fn revoked_credential_short_circuits_to_wallet_revoked() {
        let mut st = IssuerState::new();
        let wallet = [6u8; 32];
        st.credentials.insert(
            wallet,
            CredentialRecord {
                wallet,
                leaf_index: 0,
                jurisdiction: "US".into(),
                issued_at: 0,
                revoked: true,
            },
        );

        let err = handler(State(Arc::new(RwLock::new(st))), auth(wallet))
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::WalletRevoked));
    }
}
