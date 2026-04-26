use std::sync::Arc;

use anyhow::Context;
use tokio::net::TcpListener;
use tracing::info;
use tracing_subscriber::EnvFilter;

use indexer::config::Config;
use indexer::dedup::NullifierStore;
use indexer::events_store::EventStore;
use indexer::irys::client::IrysClient;
use indexer::irys::IrysUploader;
use indexer::{build_router, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env().context("loading config")?;

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new(&config.log_level)),
        )
        .json()
        .init();

    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()
        .context("building http client")?;
    let irys: Arc<dyn IrysUploader> = Arc::new(IrysClient::new(
        config.irys_node_url.clone(),
        config.irys_wallet_key.as_deref(),
        http,
    ));

    let dedup_path = std::path::Path::new(&config.dedup_path);
    std::fs::create_dir_all(dedup_path).context("creating dedup directory")?;
    let dedup = NullifierStore::open(
        dedup_path,
        config.dedup_capacity,
        std::time::Duration::from_secs(config.dedup_ttl_secs),
    )
    .context("opening dedup store")?;

    let events_path = std::path::Path::new(&config.events_path);
    std::fs::create_dir_all(events_path).context("creating events directory")?;
    let events = EventStore::open(events_path).context("opening events store")?;

    let state = Arc::new(AppState {
        config: config.clone(),
        irys,
        dedup,
        events,
    });

    let addr = format!("0.0.0.0:{}", config.port);
    let listener = TcpListener::bind(&addr).await?;
    info!(%addr, dry_run = config.is_dry_run(), "indexer starting");

    let server = axum::serve(listener, build_router(state.clone()));

    tokio::select! {
        result = server => { result?; }
        _ = tokio::signal::ctrl_c() => {
            info!("shutdown signal received, flushing dedup store");
            if let Err(e) = state.dedup.flush() {
                tracing::error!(error = %e, "failed to flush dedup store on shutdown");
            }
        }
    }

    Ok(())
}
