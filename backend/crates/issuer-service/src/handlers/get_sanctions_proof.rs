use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::convert::{fr_to_bytes_be, wallet_hex_to_bytes, wallet_to_fr};
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

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use ark_ff::AdditiveGroup;
    use tokio::sync::RwLock;

    use super::*;
    use crate::state::{CredentialRecord, IssuerState};

    #[tokio::test]
    async fn clean_wallet_yields_zero_leaf_exclusion_proof() {
        let state = Arc::new(RwLock::new(IssuerState::new()));
        let wallet = format!("0x{}", hex::encode([5u8; 32]));

        let resp = handler(State(state), Path(wallet.clone())).await.unwrap().0;

        // exclusion proof must show the wallet's slot holds Fr::ZERO
        let leaf_bytes = hex::decode(&resp.leaf_value).unwrap();
        assert_eq!(leaf_bytes, fr_to_bytes_be(&ark_bn254::Fr::ZERO));
        assert_eq!(resp.wallet, wallet);
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
        let hex = format!("0x{}", hex::encode(wallet));

        let err = handler(State(Arc::new(RwLock::new(st))), Path(hex))
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::WalletRevoked));
    }

    #[tokio::test]
    async fn invalid_hex_returns_invalid_hex() {
        let state = Arc::new(RwLock::new(IssuerState::new()));
        let err = handler(State(state), Path("not-hex".into()))
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::InvalidHex(_)));
    }
}
