use std::sync::Arc;

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use zksettle_types::gateway::ApiKeyRecord;

use crate::error::GatewayError;
use crate::key_store::hash_key;
use crate::AppState;

#[derive(Debug)]
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

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use axum::http::Request;
    use zksettle_types::gateway::Tier;

    use super::*;
    use crate::config::Config;
    use crate::key_store::KeyStore;
    use crate::metering::Metering;
    use crate::rate_limit::RateLimitStore;
    use crate::upstream::MockHttpUpstream;

    fn state_with_key(raw_key: &str) -> Arc<AppState> {
        let keys = KeyStore::new();
        keys.insert(raw_key, "alice".into(), Tier::Developer, 0);
        Arc::new(AppState {
            config: Config {
                port: 4000,
                upstream_url: "http://127.0.0.1:0".into(),
                log_level: "error".into(),
                admin_key: None,
                allow_open_keys: true,
                cors_allowed_origins: vec![],
                indexer_url: None,
            },
            keys,
            metering: Metering::new(),
            rate_limiter: RateLimitStore::new(),
            upstream: Arc::new(MockHttpUpstream::new()),
        })
    }

    async fn extract(
        state: &Arc<AppState>,
        req: Request<()>,
    ) -> Result<AuthenticatedKey, GatewayError> {
        let (mut parts, _) = req.into_parts();
        AuthenticatedKey::from_request_parts(&mut parts, state).await
    }

    #[tokio::test]
    async fn missing_authorization_header_returns_unauthorized() {
        let state = state_with_key("zks_one");
        let req = Request::builder().uri("/").body(()).unwrap();
        let err = extract(&state, req).await.unwrap_err();
        assert!(matches!(err, GatewayError::Unauthorized));
    }

    #[tokio::test]
    async fn header_without_bearer_prefix_returns_unauthorized() {
        let state = state_with_key("zks_one");
        let req = Request::builder()
            .uri("/")
            .header("authorization", "Token zks_one")
            .body(())
            .unwrap();
        let err = extract(&state, req).await.unwrap_err();
        assert!(matches!(err, GatewayError::Unauthorized));
    }

    #[tokio::test]
    async fn empty_bearer_token_returns_unauthorized() {
        let state = state_with_key("zks_one");
        let req = Request::builder()
            .uri("/")
            .header("authorization", "Bearer ")
            .body(())
            .unwrap();
        let err = extract(&state, req).await.unwrap_err();
        assert!(matches!(err, GatewayError::Unauthorized));
    }

    #[tokio::test]
    async fn unknown_key_returns_key_not_found() {
        let state = state_with_key("zks_known");
        let req = Request::builder()
            .uri("/")
            .header("authorization", "Bearer zks_unknown")
            .body(())
            .unwrap();
        let err = extract(&state, req).await.unwrap_err();
        assert!(matches!(err, GatewayError::KeyNotFound));
    }

    #[tokio::test]
    async fn valid_key_returns_record_with_owner() {
        let state = state_with_key("zks_alice");
        let req = Request::builder()
            .uri("/")
            .header("authorization", "Bearer zks_alice")
            .body(())
            .unwrap();
        let AuthenticatedKey(record) = extract(&state, req).await.unwrap();
        assert_eq!(record.owner, "alice");
        assert_eq!(record.tier, Tier::Developer);
    }
}
