use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::convert::{wallet_hex_to_bytes, wallet_to_fr};
use crate::error::ServiceError;
use crate::state::SharedState;

#[derive(Serialize)]
pub struct RevokeResponse {
    pub wallet: String,
    pub revoked: bool,
}

pub async fn handler(
    State(state): State<SharedState>,
    axum::Extension(crate::StatePath(state_path)): axum::Extension<crate::StatePath>,
    Path(wallet): Path<String>,
) -> Result<Json<RevokeResponse>, ServiceError> {
    let wallet_bytes = wallet_hex_to_bytes(&wallet)?;
    let wallet_fr = wallet_to_fr(&wallet)?;
    let mut st = state.write().await;

    let cred = st
        .credentials
        .get(&wallet_bytes)
        .ok_or(ServiceError::WalletNotFound)?;

    if cred.revoked {
        return Err(ServiceError::AlreadyRevoked);
    }

    let leaf_index = cred.leaf_index;
    let prev_roots_dirty = st.roots_dirty;

    st.membership_tree
        .zero_leaf(leaf_index)
        .map_err(ServiceError::from)?;

    let removed_from_sanctions = st.sanctions_tree.remove(wallet_fr);
    if !removed_from_sanctions {
        tracing::debug!(%wallet, "wallet was not in sanctions tree");
    }

    st.credentials
        .get_mut(&wallet_bytes)
        .expect("checked above")
        .revoked = true;

    st.roots_dirty = true;

    if let Some(ref path) = state_path {
        if let Err(e) = crate::persist::save(path, &st) {
            if let Err(e) = st.membership_tree.set_leaf(leaf_index, wallet_fr) {
                tracing::error!(%e, "rollback set_leaf failed, state may be inconsistent");
            }
            if removed_from_sanctions {
                st.sanctions_tree.insert(wallet_fr);
            }
            st.credentials
                .get_mut(&wallet_bytes)
                .expect("checked above")
                .revoked = false;
            st.roots_dirty = prev_roots_dirty;
            return Err(e.into());
        }
    }

    Ok(Json(RevokeResponse {
        wallet,
        revoked: true,
    }))
}
