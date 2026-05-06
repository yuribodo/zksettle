use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::auth::WalletAuth;
use crate::convert::fr_to_bytes_be;
use crate::error::ServiceError;
use crate::state::SharedState;

#[derive(Debug, Serialize)]
pub struct MembershipProofResponse {
    pub wallet: String,
    pub leaf_index: usize,
    pub path: Vec<String>,
    pub path_indices: Vec<u8>,
    pub root: String,
}

pub async fn handler(
    State(state): State<SharedState>,
    wallet_auth: WalletAuth,
) -> Result<Json<MembershipProofResponse>, ServiceError> {
    let st = state.read().await;

    let cred = st
        .credentials
        .get(&wallet_auth.wallet_bytes)
        .ok_or(ServiceError::WalletNotFound)?;

    if cred.revoked {
        return Err(ServiceError::WalletRevoked);
    }

    let proof = st.membership_tree.proof(cred.leaf_index)?;
    let root = st.membership_tree.root();

    Ok(Json(MembershipProofResponse {
        wallet: wallet_auth.wallet_hex,
        leaf_index: cred.leaf_index,
        path: proof
            .path
            .iter()
            .map(|f| hex::encode(fr_to_bytes_be(f)))
            .collect(),
        path_indices: proof.path_indices.to_vec(),
        root: hex::encode(fr_to_bytes_be(&root)),
    }))
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use ark_bn254::Fr;
    use tokio::sync::RwLock;
    use zksettle_crypto::{verify_merkle_proof, MerkleProof, MERKLE_DEPTH};

    use super::*;
    use crate::auth::WalletAuth;
    use crate::convert::{bytes_be_to_fr, wallet_leaf, wallet_to_fr};
    use crate::state::{CredentialRecord, IssuerState};

    fn state_with_wallet(wallet: [u8; 32], revoked: bool) -> SharedState {
        let mut st = IssuerState::new();
        let hex = format!("0x{}", hex::encode(wallet));
        st.membership_tree.insert(wallet_leaf(wallet_to_fr(&hex).unwrap()));
        st.credentials.insert(
            wallet,
            CredentialRecord {
                wallet,
                leaf_index: 0,
                jurisdiction: "US".into(),
                issued_at: 0,
                revoked,
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

    fn parse_path(hex_path: &[String]) -> [Fr; MERKLE_DEPTH] {
        let mut out = [Fr::default(); MERKLE_DEPTH];
        for (i, h) in hex_path.iter().enumerate() {
            let bytes = hex::decode(h).unwrap();
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            out[i] = bytes_be_to_fr(&arr);
        }
        out
    }

    #[tokio::test]
    async fn returns_verifiable_proof_for_known_wallet() {
        let wallet = [3u8; 32];
        let state = state_with_wallet(wallet, false);
        let hex = format!("0x{}", hex::encode(wallet));

        let resp = handler(State(state), auth(wallet)).await.unwrap().0;

        let leaf = wallet_leaf(wallet_to_fr(&hex).unwrap());
        let path: [Fr; MERKLE_DEPTH] = parse_path(&resp.path);
        let mut path_indices = [0u8; MERKLE_DEPTH];
        for (i, &b) in resp.path_indices.iter().enumerate() {
            path_indices[i] = b;
        }
        let proof = MerkleProof { path, path_indices };

        let root_bytes = hex::decode(&resp.root).unwrap();
        let mut root_arr = [0u8; 32];
        root_arr.copy_from_slice(&root_bytes);
        let root = bytes_be_to_fr(&root_arr);

        assert!(verify_merkle_proof(leaf, &proof, root));
    }

    #[tokio::test]
    async fn missing_wallet_returns_wallet_not_found() {
        let state = Arc::new(RwLock::new(IssuerState::new()));
        let err = handler(State(state), auth([1u8; 32]))
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::WalletNotFound));
    }

    #[tokio::test]
    async fn revoked_wallet_returns_wallet_revoked() {
        let wallet = [4u8; 32];
        let state = state_with_wallet(wallet, true);
        let err = handler(State(state), auth(wallet)).await.unwrap_err();
        assert!(matches!(err, ServiceError::WalletRevoked));
    }
}
