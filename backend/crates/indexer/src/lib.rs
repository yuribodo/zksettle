use std::sync::Arc;

use axum::routing::{get, post};
use axum::Router;
use sea_orm::DatabaseConnection;
use tower_http::trace::TraceLayer;

pub mod config;
pub mod dedup;
pub mod entity;
pub mod error;
pub mod helius;
pub mod irys;
pub mod routes;

use config::Config;
use dedup::NullifierStore;
use irys::IrysUploader;

pub struct AppState {
    pub config: Config,
    pub irys: Arc<dyn IrysUploader>,
    pub dedup: NullifierStore,
    pub db: Option<DatabaseConnection>,
}

pub fn build_router(state: Arc<AppState>) -> Router {
    let mut router = Router::new()
        .route("/health", get(routes::health::health))
        .route("/webhook/helius", post(routes::webhook::handle_webhook));

    if state.db.is_some() {
        router = router.route("/events", get(routes::events::list_events));
    }

    router
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
        database_url: String::new(),
    };
    let http = reqwest::Client::new();
    let irys: Arc<dyn IrysUploader> =
        Arc::new(irys::client::IrysClient::new(config.irys_node_url.clone(), None, http));
    let dedup = NullifierStore::open(tmp.path(), 1_000_000, std::time::Duration::from_secs(86400))
        .expect("failed to open test dedup store");
    let state = Arc::new(AppState {
        config,
        irys,
        dedup,
        db: None,
    });
    (build_router(state), tmp)
}

#[cfg(test)]
fn test_config(tmp: &tempfile::TempDir) -> Config {
    Config {
        port: 3000,
        helius_auth_token: "test-token".into(),
        irys_node_url: "http://localhost:0".into(),
        irys_wallet_key: None,
        program_id: "11111111111111111111111111111111".into(),
        log_level: "error".into(),
        dedup_path: tmp.path().to_string_lossy().into_owned(),
        dedup_capacity: 1_000_000,
        dedup_ttl_secs: 86400,
        database_url: String::new(),
    }
}

#[cfg(test)]
pub async fn test_db() -> DatabaseConnection {
    let url = std::env::var("INDEXER_TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgres://zksettle:zksettle_dev@localhost:5432/zksettle_indexer_test".into()
    });
    config::db::connect_and_migrate(&url)
        .await
        .expect("failed to connect to test database")
}

#[cfg(test)]
pub async fn test_cleanup(db: &DatabaseConnection) {
    use sea_orm::EntityTrait;
    entity::event::Entity::delete_many()
        .exec(db)
        .await
        .expect("failed to clean up test events");
}

#[cfg(test)]
pub async fn test_app_with_db() -> (Router, tempfile::TempDir, Arc<AppState>) {
    let db = test_db().await;
    test_cleanup(&db).await;

    let tmp = tempfile::tempdir().expect("failed to create tempdir for test dedup store");
    let config = test_config(&tmp);
    let irys: Arc<dyn IrysUploader> = Arc::new(irys::MockIrysUploader::new());
    let dedup = NullifierStore::open(tmp.path(), 1_000_000, std::time::Duration::from_secs(86400))
        .expect("failed to open test dedup store");
    let state = Arc::new(AppState {
        config,
        irys,
        dedup,
        db: Some(db),
    });
    let router = build_router(state.clone());
    (router, tmp, state)
}

#[cfg(test)]
mod tests {
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    use super::*;

    #[tokio::test]
    async fn events_route_registered_when_db_present() {
        let (app, _tmp, _state) = test_app_with_db().await;
        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/events")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
    }

    #[tokio::test]
    async fn events_route_not_registered_when_db_absent() {
        let (app, _tmp) = test_app();
        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/events")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 404);
    }
}
