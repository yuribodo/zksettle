use std::sync::Arc;

use anyhow::Context;
use tokio::net::TcpListener;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;

use api_gateway::config::Config;
use api_gateway::key_store::KeyStore;
use api_gateway::metering::Metering;
use api_gateway::rate_limit::RateLimitStore;
use api_gateway::{build_router, AppState};

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

    let state = Arc::new(AppState {
        config: config.clone(),
        keys: KeyStore::new(),
        metering: Metering::new(),
        rate_limiter: RateLimitStore::new(),
        http,
    });

    if config.admin_key.is_none() {
        if config.allow_open_keys {
            warn!("GATEWAY_ADMIN_KEY not set and GATEWAY_ALLOW_OPEN_KEYS=true: key provisioning is open to anyone");
        } else {
            info!("GATEWAY_ADMIN_KEY not set: key provisioning disabled (set GATEWAY_ALLOW_OPEN_KEYS=true to allow open access)");
        }
    }

    let addr = format!("0.0.0.0:{}", config.port);
    let listener = TcpListener::bind(&addr).await?;
    info!(%addr, "api-gateway starting");

    axum::serve(listener, build_router(state)).await?;

    Ok(())
}
