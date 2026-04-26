use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::Json;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zksettle_types::gateway::Tier;

use crate::config::Config;
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

#[derive(Serialize, Deserialize)]
pub struct ListedKey {
    pub key_hash: String,
    pub tier: Tier,
    pub owner: String,
    pub created_at: u64,
}

#[derive(Serialize, Deserialize)]
pub struct ListKeysResponse {
    pub keys: Vec<ListedKey>,
}

#[derive(Serialize, Deserialize)]
pub struct DeleteKeyResponse {
    pub key_hash: String,
    pub deleted: bool,
}

fn constant_time_eq(a: &str, b: &str) -> bool {
    let a_hash = Sha256::digest(a.as_bytes());
    let b_hash = Sha256::digest(b.as_bytes());
    a_hash == b_hash
}

/// Admin-auth gate shared by `POST /api-keys`, `GET /api-keys`, and `DELETE /api-keys/{hash}`.
/// - `admin_key` set → require matching `Authorization: Bearer <admin_key>`.
/// - `allow_open_keys` true → accept anonymous calls.
/// - Otherwise → 500 Config (admin operations are disabled by deployment).
fn verify_admin(config: &Config, headers: &HeaderMap) -> Result<(), GatewayError> {
    if let Some(ref admin_key) = config.admin_key {
        let provided = headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(GatewayError::Forbidden)?;

        if !constant_time_eq(provided, admin_key) {
            return Err(GatewayError::Forbidden);
        }
        return Ok(());
    }
    if config.allow_open_keys {
        return Ok(());
    }
    Err(GatewayError::Config(
        "key administration disabled: set GATEWAY_ADMIN_KEY or GATEWAY_ALLOW_OPEN_KEYS=true"
            .into(),
    ))
}

pub async fn create_key(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<CreateKeyRequest>,
) -> Result<Json<CreateKeyResponse>, GatewayError> {
    verify_admin(&state.config, &headers)?;

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

pub async fn list_keys(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<ListKeysResponse>, GatewayError> {
    verify_admin(&state.config, &headers)?;

    let mut keys: Vec<ListedKey> = state
        .keys
        .list()
        .into_iter()
        .map(|r| ListedKey {
            key_hash: r.key_hash,
            tier: r.tier,
            owner: r.owner,
            created_at: r.created_at,
        })
        .collect();
    keys.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(Json(ListKeysResponse { keys }))
}

pub async fn delete_key(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(key_hash): Path<String>,
) -> Result<Json<DeleteKeyResponse>, GatewayError> {
    verify_admin(&state.config, &headers)?;

    let removed = state.keys.remove_by_hash(&key_hash);
    if !removed {
        return Err(GatewayError::NotFound);
    }
    Ok(Json(DeleteKeyResponse {
        key_hash,
        deleted: true,
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
    use crate::key_store::{hash_key, KeyStore};
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

    fn app_with_admin_key() -> (axum::Router, Arc<AppState>) {
        let config = Config {
            port: 4000,
            upstream_url: "http://localhost:0".into(),
            log_level: "error".into(),
            admin_key: Some("secret-admin".into()),
            allow_open_keys: false,
            cors_allowed_origins: vec![],
            indexer_url: None,
        };
        let state = Arc::new(AppState {
            config,
            keys: KeyStore::new(),
            metering: Metering::new(),
            rate_limiter: RateLimitStore::new(),
            upstream: Arc::new(crate::upstream::ReqwestUpstream::new(reqwest::Client::new())),
        });
        (build_router(state.clone()), state)
    }

    fn app_with_provisioning_disabled() -> axum::Router {
        let config = Config {
            port: 4000,
            upstream_url: "http://localhost:0".into(),
            log_level: "error".into(),
            admin_key: None,
            allow_open_keys: false,
            cors_allowed_origins: vec![],
            indexer_url: None,
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
        let (app, _) = app_with_admin_key();
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
        let (app, _) = app_with_admin_key();
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
        let (app, _) = app_with_admin_key();
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

    #[tokio::test]
    async fn list_keys_requires_admin_auth() {
        let (app, _) = app_with_admin_key();
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api-keys")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 403);
    }

    #[tokio::test]
    async fn list_keys_returns_provisioned_records() {
        let (app, state) = app_with_admin_key();
        state
            .keys
            .insert("zks_a", "alice".into(), Tier::Developer, 100);
        state
            .keys
            .insert("zks_b", "bob".into(), Tier::Startup, 200);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api-keys")
                    .header("authorization", "Bearer secret-admin")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: ListKeysResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.keys.len(), 2);
        // Sorted by created_at desc → bob first.
        assert_eq!(body.keys[0].owner, "bob");
        assert_eq!(body.keys[1].owner, "alice");
    }

    #[tokio::test]
    async fn list_keys_open_when_provisioning_open() {
        let app = test_app(); // admin_key=None, allow_open_keys=true
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api-keys")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
    }

    #[tokio::test]
    async fn list_keys_500_when_provisioning_disabled() {
        let app = app_with_provisioning_disabled();
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api-keys")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 500);
    }

    #[tokio::test]
    async fn delete_key_requires_admin_auth() {
        let (app, _) = app_with_admin_key();
        let hash = hash_key("zks_x");
        let resp = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api-keys/{hash}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 403);
    }

    #[tokio::test]
    async fn delete_key_404_for_unknown_hash() {
        let (app, _) = app_with_admin_key();
        let unknown = "0".repeat(64);
        let resp = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api-keys/{unknown}"))
                    .header("authorization", "Bearer secret-admin")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 404);
    }

    #[tokio::test]
    async fn delete_key_evicts_and_invalidates_subsequent_auth() {
        let (app, state) = app_with_admin_key();
        let raw = "zks_to_delete";
        state
            .keys
            .insert(raw, "carol".into(), Tier::Developer, 300);
        let hash = hash_key(raw);

        // Confirm the key works for /usage initially.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/usage")
                    .header("authorization", format!("Bearer {raw}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);

        // Delete it.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api-keys/{hash}"))
                    .header("authorization", "Bearer secret-admin")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: DeleteKeyResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.key_hash, hash);
        assert!(body.deleted);

        // Now /usage with that key is 401.
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/usage")
                    .header("authorization", format!("Bearer {raw}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 401);
    }
}
