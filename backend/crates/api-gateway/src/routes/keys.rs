use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zksettle_types::gateway::Tier;

use crate::error::GatewayError;
use crate::key_store::generate_key;
use crate::AppState;

#[derive(Deserialize)]
pub struct CreateKeyRequest {
    pub owner: String,
}

#[derive(Serialize, Deserialize)]
pub struct CreateKeyResponse {
    pub api_key: String,
    pub tier: Tier,
    pub owner: String,
}

fn constant_time_eq(a: &str, b: &str) -> bool {
    let a_hash = Sha256::digest(a.as_bytes());
    let b_hash = Sha256::digest(b.as_bytes());
    a_hash == b_hash
}

pub async fn create_key(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<CreateKeyRequest>,
) -> Result<Json<CreateKeyResponse>, GatewayError> {
    if let Some(ref admin_key) = state.config.admin_key {
        let provided = headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(GatewayError::Forbidden)?;

        if !constant_time_eq(provided, admin_key) {
            return Err(GatewayError::Forbidden);
        }
    } else if !state.config.allow_open_keys {
        return Err(GatewayError::Config(
            "key provisioning disabled: set GATEWAY_ADMIN_KEY or GATEWAY_ALLOW_OPEN_KEYS=true"
                .into(),
        ));
    }

    let raw_key = generate_key();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    state
        .keys
        .insert(&raw_key, body.owner.clone(), Tier::Developer, now);

    Ok(Json(CreateKeyResponse {
        api_key: raw_key,
        tier: Tier::Developer,
        owner: body.owner,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    use crate::config::Config;
    use crate::key_store::KeyStore;
    use crate::metering::Metering;
    use crate::rate_limit::RateLimitStore;
    use crate::{build_router, test_app, AppState};

    #[tokio::test]
    async fn create_key_no_admin_key_configured_allows_open() {
        let app = test_app();
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api-keys")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"owner":"alice"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: CreateKeyResponse = serde_json::from_slice(&bytes).unwrap();
        assert!(body.api_key.starts_with("zks_"));
        assert_eq!(body.tier, Tier::Developer);
        assert_eq!(body.owner, "alice");
    }

    fn app_with_admin_key() -> axum::Router {
        let config = Config {
            port: 4000,
            upstream_url: "http://localhost:0".into(),
            log_level: "error".into(),
            admin_key: Some("secret-admin".into()),
            allow_open_keys: false,
        };
        let state = Arc::new(AppState {
            config,
            keys: KeyStore::new(),
            metering: Metering::new(),
            rate_limiter: RateLimitStore::new(),
            upstream: Arc::new(crate::upstream::ReqwestUpstream::new(reqwest::Client::new())),
        });
        build_router(state)
    }

    #[tokio::test]
    async fn create_key_rejects_without_admin_auth() {
        let app = app_with_admin_key();
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api-keys")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"owner":"alice"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), 403);
    }

    #[tokio::test]
    async fn create_key_rejects_wrong_admin_key() {
        let app = app_with_admin_key();
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api-keys")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer wrong-key")
                    .body(Body::from(r#"{"owner":"alice"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), 403);
    }

    #[tokio::test]
    async fn create_key_accepts_correct_admin_key() {
        let app = app_with_admin_key();
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api-keys")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer secret-admin")
                    .body(Body::from(r#"{"owner":"alice"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: CreateKeyResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.owner, "alice");
    }
}
