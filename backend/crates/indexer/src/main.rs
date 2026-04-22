use std::sync::Arc;

use anyhow::Context;
use tokio::net::TcpListener;
use tracing::info;
use tracing_subscriber::EnvFilter;

use indexer::config::Config;
use indexer::dedup::NullifierStore;
use indexer::irys::client::IrysClient;
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

    let http = reqwest::Client::new();
    let irys = IrysClient::new(
        config.irys_node_url.clone(),
        config.irys_wallet_key.as_deref(),
        http,
    );

    let state = Arc::new(AppState {
        config: config.clone(),
        irys,
        dedup: NullifierStore::new(),
    });

    let addr = format!("0.0.0.0:{}", config.port);
    let listener = TcpListener::bind(&addr).await?;
    info!(%addr, dry_run = config.is_dry_run(), "indexer starting");

    axum::serve(listener, build_router(state)).await?;
    Ok(())
}
