use std::sync::Arc;

use axum::routing::{get, post};
use axum::Router;
use tower_http::trace::TraceLayer;

pub mod config;
pub mod dedup;
pub mod error;
pub mod helius;
pub mod irys;
pub mod routes;

use config::Config;
use dedup::NullifierStore;
use irys::client::IrysClient;

pub struct AppState {
    pub config: Config,
    pub irys: IrysClient,
    pub dedup: NullifierStore,
}

pub fn build_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(routes::health::health))
        .route("/webhook/helius", post(routes::webhook::handle_webhook))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[cfg(test)]
pub fn test_app() -> (Router, tempfile::TempDir) {
    let tmp = tempfile::tempdir().expect("failed to create tempdir for test dedup store");
    let config = Config {
        port: 3000,
        helius_auth_token: "test-token".into(),
        irys_node_url: "http://localhost:0".into(),
        irys_wallet_key: None,
        program_id: "11111111111111111111111111111111".into(),
        log_level: "error".into(),
        dedup_path: tmp.path().to_string_lossy().into_owned(),
        dedup_capacity: 1_000_000,
        dedup_ttl_secs: 86400,
    };
    let http = reqwest::Client::new();
    let irys = IrysClient::new(config.irys_node_url.clone(), None, http);
    let dedup = NullifierStore::open(tmp.path(), 1_000_000, std::time::Duration::from_secs(86400))
        .expect("failed to open test dedup store");
    let state = Arc::new(AppState {
        config,
        irys,
        dedup,
    });
    (build_router(state), tmp)
}
