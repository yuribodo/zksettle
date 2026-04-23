use std::sync::Arc;

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use zksettle_types::gateway::ApiKeyRecord;

use crate::error::GatewayError;
use crate::key_store::hash_key;
use crate::AppState;

pub struct AuthenticatedKey(pub ApiKeyRecord);

impl FromRequestParts<Arc<AppState>> for AuthenticatedKey {
    type Rejection = GatewayError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or(GatewayError::Unauthorized)?;

        let token = header
            .strip_prefix("Bearer ")
            .ok_or(GatewayError::Unauthorized)?;

        if token.is_empty() {
            return Err(GatewayError::Unauthorized);
        }

        let hash = hash_key(token);
        let record = state
            .keys
            .lookup_by_hash(&hash)
            .ok_or(GatewayError::KeyNotFound)?;

        Ok(AuthenticatedKey(record))
    }
}
