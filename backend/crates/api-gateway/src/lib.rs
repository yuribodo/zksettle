use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const SESSION_COOKIE: &str = "session";

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before Unix epoch")
        .as_secs()
}

use axum::http::{HeaderValue, Method};
use axum::routing::{any, delete, get, post};
use axum::Router;
use sea_orm::DatabaseConnection;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::warn;

pub mod auth;
pub mod auth_jwt;
pub mod config;
pub mod entity;
pub mod error;
pub mod jwt;
pub mod key_store;
pub mod metering;
pub mod nonce_store;
pub mod proxy;
pub mod rate_limit;
pub mod routes;
pub mod siws;
pub mod tenant_store;
pub mod upstream;

use config::Config;
#[cfg(test)]
use config::CookieSameSite;
use rate_limit::{LoginRateLimiter, RateLimitStore};
use upstream::HttpUpstream;

pub struct AppState {
    pub config: Config,
    pub db: DatabaseConnection,
    pub rate_limiter: RateLimitStore,
    pub login_rate_limiter: Arc<LoginRateLimiter>,
    pub upstream: Arc<dyn HttpUpstream>,
    pub nonce_store: nonce_store::NonceStore,
}

pub fn build_router(state: Arc<AppState>) -> Router {
    let cors = build_cors_layer(&state.config.cors_allowed_origins);

    Router::new()
        .route("/health", get(routes::health::health))
        .route(
            "/api-keys",
            get(routes::keys::list_keys).post(routes::keys::create_key),
        )
        .route("/api-keys/{key_hash}", delete(routes::keys::delete_key))
        .route("/usage", get(routes::usage::get_usage))
        .route("/usage/history", get(routes::usage::get_usage_history))
        .route("/auth/challenge", get(routes::challenge::get_challenge))
        .route("/auth/login", post(routes::auth::login))
        .route("/auth/logout", post(routes::auth::logout))
        .route("/auth/me", get(routes::auth::me))
        .route("/v1/{*path}", any(proxy::proxy_to_upstream))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

fn build_cors_layer(allowed_origins: &[String]) -> CorsLayer {
    let base = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::header::COOKIE,
            axum::http::HeaderName::from_static("x-wallet-signature"),
            axum::http::HeaderName::from_static("x-wallet-timestamp"),
        ])
        .allow_credentials(true)
        .max_age(Duration::from_secs(600));

    if allowed_origins.is_empty() {
        warn!(
            "GATEWAY_CORS_ALLOWED_ORIGINS not set: browser callers will be blocked by CORS. \
             Set it to a comma-separated origin list (e.g. https://app.example.com,http://localhost:3000)."
        );
        return base;
    }

    let parsed: Vec<HeaderValue> = allowed_origins
        .iter()
        .filter_map(|origin| match HeaderValue::from_str(origin) {
            Ok(v) => Some(v),
            Err(err) => {
                warn!(%origin, %err, "ignoring invalid CORS origin");
                None
            }
        })
        .collect();

    base.allow_origin(AllowOrigin::list(parsed))
}

#[cfg(test)]
pub async fn test_db() -> DatabaseConnection {
    let url = std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must be set for tests");
    config::db::connect_and_migrate(&url).await.expect("test DB connect")
}

#[cfg(test)]
pub async fn test_cleanup(db: &DatabaseConnection) {
    use sea_orm::EntityTrait;
    entity::api_key::Entity::delete_many().exec(db).await.unwrap();
    entity::tenant::Entity::delete_many().exec(db).await.unwrap();
}

#[cfg(test)]
pub async fn test_state() -> Arc<AppState> {
    let db = test_db().await;
    let config = Config {
        port: 4000,
        upstream_url: "http://localhost:0".into(),
        log_level: "error".into(),
        admin_key: None,
        allow_open_keys: true,
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
    Arc::new(AppState {
        config,
        db,
        rate_limiter: RateLimitStore::new(),
        login_rate_limiter: Arc::new(LoginRateLimiter::new()),
        upstream: Arc::new(upstream::ReqwestUpstream::new(reqwest::Client::new())),
        nonce_store: nonce_store::NonceStore::new(),
    })
}

#[cfg(test)]
pub async fn test_app() -> Router {
    build_router(test_state().await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use serial_test::serial;
    use tower::ServiceExt;

    async fn app_with_origins(origins: Vec<&str>) -> Router {
        let db = test_db().await;
        let config = Config {
            port: 4000,
            upstream_url: "http://localhost:0".into(),
            log_level: "error".into(),
            admin_key: None,
            allow_open_keys: true,
            cors_allowed_origins: origins.into_iter().map(String::from).collect(),
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
            login_rate_limiter: Arc::new(LoginRateLimiter::new()),
            upstream: Arc::new(upstream::ReqwestUpstream::new(reqwest::Client::new())),
            nonce_store: nonce_store::NonceStore::new(),
        });
        build_router(state)
    }

    #[tokio::test]
    #[serial]
    async fn cors_preflight_allowed_origin_returns_200() {
        let app = app_with_origins(vec!["http://localhost:3000"]).await;
        let resp = app
            .oneshot(
                Request::builder()
                    .method("OPTIONS")
                    .uri("/health")
                    .header("origin", "http://localhost:3000")
                    .header("access-control-request-method", "GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        assert!(resp
            .headers()
            .get("access-control-allow-origin")
            .is_some());
    }

    #[tokio::test]
    #[serial]
    async fn cors_preflight_disallowed_origin_blocked() {
        let app = app_with_origins(vec!["http://localhost:3000"]).await;
        let resp = app
            .oneshot(
                Request::builder()
                    .method("OPTIONS")
                    .uri("/health")
                    .header("origin", "http://evil.example.com")
                    .header("access-control-request-method", "GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert!(resp
            .headers()
            .get("access-control-allow-origin")
            .is_none());
    }

    #[tokio::test]
    #[serial]
    async fn cors_empty_origins_no_allow_header() {
        let app = app_with_origins(vec![]).await;
        let resp = app
            .oneshot(
                Request::builder()
                    .method("OPTIONS")
                    .uri("/health")
                    .header("origin", "http://localhost:3000")
                    .header("access-control-request-method", "GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert!(resp
            .headers()
            .get("access-control-allow-origin")
            .is_none());
    }
}
