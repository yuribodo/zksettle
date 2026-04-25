use std::sync::Arc;

use axum::routing::{get, post};
use axum::Router;
use tower_http::trace::TraceLayer;

pub mod config;
pub mod dedup;
pub mod error;
pub mod events_store;
pub mod helius;
pub mod irys;
pub mod routes;

use config::Config;
use dedup::NullifierStore;
use events_store::EventStore;
use irys::IrysUploader;

pub struct AppState {
    pub config: Config,
    pub irys: Arc<dyn IrysUploader>,
    pub dedup: NullifierStore,
    pub events: EventStore,
}

pub fn build_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(routes::health::health))
        .route("/webhook/helius", post(routes::webhook::handle_webhook))
        .route("/events", get(routes::events::list_events))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[cfg(test)]
pub fn test_app() -> (Router, tempfile::TempDir) {
    let tmp = tempfile::tempdir().expect("failed to create tempdir for test stores");
    let dedup_dir = tmp.path().join("dedup");
    let events_dir = tmp.path().join("events");
    std::fs::create_dir_all(&dedup_dir).unwrap();
    std::fs::create_dir_all(&events_dir).unwrap();
    let config = Config {
        port: 3000,
        helius_auth_token: "test-token".into(),
        irys_node_url: "http://localhost:0".into(),
        irys_wallet_key: None,
        program_id: "11111111111111111111111111111111".into(),
        log_level: "error".into(),
        dedup_path: dedup_dir.to_string_lossy().into_owned(),
        dedup_capacity: 1_000_000,
        dedup_ttl_secs: 86400,
        events_path: events_dir.to_string_lossy().into_owned(),
    };
    let http = reqwest::Client::new();
    let irys: Arc<dyn IrysUploader> =
        Arc::new(irys::client::IrysClient::new(config.irys_node_url.clone(), None, http));
    let dedup = NullifierStore::open(&dedup_dir, 1_000_000, std::time::Duration::from_secs(86400))
        .expect("failed to open test dedup store");
    let events = EventStore::open(&events_dir).expect("failed to open test events store");
    let state = Arc::new(AppState {
        config,
        irys,
        dedup,
        events,
    });
    (build_router(state), tmp)
}
