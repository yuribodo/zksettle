use axum::extract::State;
use axum::Json;
use serde::Serialize;
use solana_rpc_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;

use crate::chain;
use crate::error::ServiceError;
use crate::state::SharedState;

#[derive(Serialize)]
pub struct PublishResponse {
    pub slot: u64,
    pub registered: bool,
}

pub async fn handler(
    State(state): State<SharedState>,
    axum::Extension(rpc_url): axum::Extension<String>,
    axum::Extension(keypair_bytes): axum::Extension<Vec<u8>>,
    axum::Extension(program_id): axum::Extension<Pubkey>,
) -> Result<Json<PublishResponse>, ServiceError> {
    let rpc = RpcClient::new(rpc_url);
    let keypair = Keypair::try_from(keypair_bytes.as_slice())
        .map_err(|e| ServiceError::Chain(e.to_string()))?;

    let mut st = state.write().await;
    let (mr, sr, jr) = st.roots_as_bytes();

    let result = if !st.registered {
        chain::register_issuer(&rpc, &keypair, &program_id, mr, sr, jr)
    } else {
        chain::update_issuer_root(&rpc, &keypair, &program_id, mr, sr, jr)
    };

    match result {
        Ok(slot) => {
            let was_registered = st.registered;
            if !was_registered {
                st.registered = true;
            }
            st.last_publish_slot = slot;
            Ok(Json(PublishResponse {
                slot,
                registered: !was_registered,
            }))
        }
        Err(e) => Err(e),
    }
}
