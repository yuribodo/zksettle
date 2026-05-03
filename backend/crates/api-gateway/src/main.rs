use std::sync::Arc;

use anyhow::Context;
use tokio::net::TcpListener;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;

use api_gateway::config::{db, Config};
use api_gateway::nonce_store::NonceStore;
use api_gateway::rate_limit::{LoginRateLimiter, RateLimitStore};
use api_gateway::upstream::ReqwestUpstream;
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

    info!("connecting to database and running migrations");
    let db = db::connect_and_migrate(&config.database_url)
        .await
        .context("database setup")?;

    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()
        .context("building http client")?;

    let login_rate_limiter = Arc::new(LoginRateLimiter::with_per_minute(config.login_rate_limit_per_minute));
    login_rate_limiter.spawn_cleanup();

    let nonce_store = NonceStore::new();
    nonce_store.spawn_cleanup();

    let state = Arc::new(AppState {
        config: config.clone(),
        db,
        rate_limiter: RateLimitStore::new(),
        login_rate_limiter,
        upstream: Arc::new(ReqwestUpstream::new(http)),
        nonce_store,
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

    axum::serve(
        listener,
        build_router(state).into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;

    Ok(())
}
