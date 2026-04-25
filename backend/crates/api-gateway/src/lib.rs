use std::sync::Arc;

use axum::routing::{any, get, post};
use axum::Router;
use tower_http::trace::TraceLayer;

pub mod auth;
pub mod config;
pub mod error;
pub mod key_store;
pub mod metering;
pub mod proxy;
pub mod rate_limit;
pub mod routes;
pub mod upstream;

use config::Config;
use key_store::KeyStore;
use metering::Metering;
use rate_limit::RateLimitStore;
use upstream::HttpUpstream;

pub struct AppState {
    pub config: Config,
    pub keys: KeyStore,
    pub metering: Metering,
    pub rate_limiter: RateLimitStore,
    pub upstream: Arc<dyn HttpUpstream>,
}

pub fn build_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(routes::health::health))
        .route("/api-keys", post(routes::keys::create_key))
        .route("/usage", get(routes::usage::get_usage))
        .route("/v1/{*path}", any(proxy::proxy_to_upstream))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[cfg(test)]
pub fn test_state() -> Arc<AppState> {
    let config = Config {
        port: 4000,
        upstream_url: "http://localhost:0".into(),
        log_level: "error".into(),
        admin_key: None,
        allow_open_keys: true,
    };
    Arc::new(AppState {
        config,
        keys: KeyStore::new(),
        metering: Metering::new(),
        rate_limiter: RateLimitStore::new(),
        upstream: Arc::new(upstream::ReqwestUpstream::new(reqwest::Client::new())),
    })
}

#[cfg(test)]
pub fn test_app() -> Router {
    build_router(test_state())
}
