use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::chain;
use crate::error::ServiceError;
use crate::state::{PublishLock, SharedState};
use crate::{KeypairBytes, ProgramId, RpcUrl};

#[derive(Serialize)]
pub struct PublishResponse {
    pub slot: u64,
    pub registered: bool,
}

pub async fn handler(
    State(state): State<SharedState>,
    axum::Extension(RpcUrl(rpc_url)): axum::Extension<RpcUrl>,
    axum::Extension(KeypairBytes(keypair_bytes)): axum::Extension<KeypairBytes>,
    axum::Extension(ProgramId(program_id)): axum::Extension<ProgramId>,
    axum::Extension(publish_lock): axum::Extension<PublishLock>,
) -> Result<Json<PublishResponse>, ServiceError> {
    let _guard = publish_lock.lock().await;

    let (mr, sr, jr, was_registered) = {
        let st = state.read().await;
        let roots = st.roots_as_bytes();
        (roots.0, roots.1, roots.2, st.registered)
    };

    let result = tokio::task::spawn_blocking(move || {
        chain::publish_roots(&rpc_url, &keypair_bytes, &program_id, mr, sr, jr, was_registered)
    })
    .await
    .map_err(|e| ServiceError::Chain(e.to_string()))??;

    let mut st = state.write().await;
    if result.did_register && !st.registered {
        st.registered = true;
    }
    st.last_publish_slot = result.slot;
    let registered = st.registered;

    Ok(Json(PublishResponse {
        slot: result.slot,
        registered,
    }))
}
