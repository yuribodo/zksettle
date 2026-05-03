use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::Json;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zksettle_types::gateway::Tier;

use crate::auth_jwt::MaybeAuthenticatedTenant;
use crate::config::Config;
use crate::error::GatewayError;
use crate::key_store;
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
    use subtle::ConstantTimeEq;
    let a_hash = Sha256::digest(a.as_bytes());
    let b_hash = Sha256::digest(b.as_bytes());
    a_hash.ct_eq(&b_hash).into()
}

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
    MaybeAuthenticatedTenant(maybe_tenant): MaybeAuthenticatedTenant,
    headers: HeaderMap,
    Json(body): Json<CreateKeyRequest>,
) -> Result<Json<CreateKeyResponse>, GatewayError> {
    let raw_key = key_store::generate_key();
    let now = crate::now_secs();

    let owner = if let Some(tenant) = maybe_tenant {
        let owner = tenant.wallet.clone();
        key_store::insert(
            &state.db,
            &raw_key,
            owner.clone(),
            Tier::Developer,
            now,
            Some(tenant.tenant_id),
        )
        .await?;
        owner
    } else {
        verify_admin(&state.config, &headers)?;
        key_store::insert(&state.db, &raw_key, body.owner.clone(), Tier::Developer, now, None).await?;
        body.owner.clone()
    };

    Ok(Json(CreateKeyResponse {
        api_key: raw_key,
        tier: Tier::Developer,
        owner,
    }))
}

pub async fn list_keys(
    State(state): State<Arc<AppState>>,
    MaybeAuthenticatedTenant(maybe_tenant): MaybeAuthenticatedTenant,
    headers: HeaderMap,
) -> Result<Json<ListKeysResponse>, GatewayError> {
    let records = if let Some(tenant) = maybe_tenant {
        key_store::list_by_tenant(&state.db, tenant.tenant_id).await?
    } else {
        verify_admin(&state.config, &headers)?;
        key_store::list(&state.db).await?
    };

    let mut keys: Vec<ListedKey> = records
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
    MaybeAuthenticatedTenant(maybe_tenant): MaybeAuthenticatedTenant,
    headers: HeaderMap,
    Path(key_hash): Path<String>,
) -> Result<Json<DeleteKeyResponse>, GatewayError> {
    let removed = if let Some(tenant) = maybe_tenant {
        key_store::remove_by_hash_and_tenant(&state.db, &key_hash, tenant.tenant_id).await?
    } else {
        verify_admin(&state.config, &headers)?;
        key_store::remove_by_hash(&state.db, &key_hash).await?
    };

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

    use crate::config::{Config, CookieSameSite};
    use crate::rate_limit::RateLimitStore;
    use crate::{build_router, test_app, test_cleanup, test_db, AppState};
    use serial_test::serial;

    #[tokio::test]
    #[serial]
    async fn create_key_no_admin_key_configured_allows_open() {
        let app = test_app().await;
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

    async fn app_with_admin_key() -> (axum::Router, Arc<AppState>) {
        let db = test_db().await;
        test_cleanup(&db).await;
        let config = Config {
            port: 4000,
            upstream_url: "http://localhost:0".into(),
            log_level: "error".into(),
            admin_key: Some("secret-admin".into()),
            allow_open_keys: false,
            cors_allowed_origins: vec![],
            indexer_url: None,
            database_url: String::new(),
            jwt_secret: None,
            jwt_ttl_secs: 86400,
            siws_domain: None,
            cookie_secure: false,
            cookie_same_site: CookieSameSite::Lax,
            login_rate_limit_per_minute: 5,
        };
        let state = Arc::new(AppState {
            config,
            db,
            rate_limiter: RateLimitStore::new(),
            login_rate_limiter: crate::rate_limit::LoginRateLimiter::new(),
            upstream: Arc::new(crate::upstream::ReqwestUpstream::new(reqwest::Client::new())),
        });
        (build_router(state.clone()), state)
    }

    async fn app_with_provisioning_disabled() -> axum::Router {
        let db = test_db().await;
        test_cleanup(&db).await;
        let config = Config {
            port: 4000,
            upstream_url: "http://localhost:0".into(),
            log_level: "error".into(),
            admin_key: None,
            allow_open_keys: false,
            cors_allowed_origins: vec![],
            indexer_url: None,
            database_url: String::new(),
            jwt_secret: None,
            jwt_ttl_secs: 86400,
            siws_domain: None,
            cookie_secure: false,
            cookie_same_site: CookieSameSite::Lax,
            login_rate_limit_per_minute: 5,
        };
        let state = Arc::new(AppState {
            config,
            db,
            rate_limiter: RateLimitStore::new(),
            login_rate_limiter: crate::rate_limit::LoginRateLimiter::new(),
            upstream: Arc::new(crate::upstream::ReqwestUpstream::new(reqwest::Client::new())),
        });
        build_router(state)
    }

    #[tokio::test]
    #[serial]
    async fn create_key_rejects_without_admin_auth() {
        let (app, _) = app_with_admin_key().await;
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
    #[serial]
    async fn create_key_rejects_wrong_admin_key() {
        let (app, _) = app_with_admin_key().await;
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
    #[serial]
    async fn create_key_accepts_correct_admin_key() {
        let (app, _) = app_with_admin_key().await;
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
    #[serial]
    async fn list_keys_requires_admin_auth() {
        let (app, _) = app_with_admin_key().await;
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
    #[serial]
    async fn list_keys_returns_provisioned_records() {
        let (app, state) = app_with_admin_key().await;
        key_store::insert(&state.db, "zks_a", "alice".into(), Tier::Developer, 100, None)
            .await
            .unwrap();
        key_store::insert(&state.db, "zks_b", "bob".into(), Tier::Startup, 200, None)
            .await
            .unwrap();

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
        assert_eq!(body.keys[0].owner, "bob");
        assert_eq!(body.keys[1].owner, "alice");
    }

    #[tokio::test]
    #[serial]
    async fn list_keys_open_when_provisioning_open() {
        let app = test_app().await;
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
    #[serial]
    async fn list_keys_500_when_provisioning_disabled() {
        let app = app_with_provisioning_disabled().await;
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
    #[serial]
    async fn delete_key_requires_admin_auth() {
        let (app, _) = app_with_admin_key().await;
        let hash = key_store::hash_key("zks_x");
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
    #[serial]
    async fn delete_key_404_for_unknown_hash() {
        let (app, _) = app_with_admin_key().await;
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
    #[serial]
    async fn delete_key_evicts_and_invalidates_subsequent_auth() {
        let (app, state) = app_with_admin_key().await;
        let raw = "zks_to_delete";
        key_store::insert(&state.db, raw, "carol".into(), Tier::Developer, 300, None)
            .await
            .unwrap();
        let hash = key_store::hash_key(raw);

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
