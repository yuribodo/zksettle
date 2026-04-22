mod chain;
mod config;
mod convert;
mod error;
mod handlers;
mod rotation;
mod state;

use std::sync::Arc;

use axum::routing::{get, post};
use axum::{Extension, Router};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::Signer;
use tokio::sync::{watch, RwLock};

use config::Config;
use state::IssuerState;

#[derive(Clone)]
pub struct RpcUrl(pub String);
#[derive(Clone)]
pub struct KeypairBytes(pub Vec<u8>);
#[derive(Clone)]
pub struct ProgramId(pub Pubkey);

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "issuer_service=info".into()),
        )
        .init();

    let cfg = Config::from_env();

    let keypair_bytes = std::fs::read(&cfg.keypair_path)
        .unwrap_or_else(|e| panic!("failed to read keypair at {}: {e}", cfg.keypair_path));
    let keypair_json: Vec<u8> = serde_json::from_slice(&keypair_bytes)
        .unwrap_or_else(|e| panic!("failed to parse keypair JSON: {e}"));
    let keypair = Keypair::try_from(keypair_json.as_slice())
        .unwrap_or_else(|e| panic!("invalid keypair bytes: {e}"));
    let program_id: Pubkey = cfg
        .program_id
        .parse()
        .unwrap_or_else(|e| panic!("invalid program ID '{}': {e}", cfg.program_id));

    tracing::info!(
        authority = %keypair.pubkey(),
        %program_id,
        rpc = %cfg.rpc_url,
        listen = %cfg.listen_addr,
        rotation_secs = cfg.rotation_interval_secs,
        "starting issuer service"
    );

    let shared = Arc::new(RwLock::new(IssuerState::new()));
    let (shutdown_tx, shutdown_rx) = watch::channel(());

    let rotation_keypair = Keypair::try_from(keypair_json.as_slice()).unwrap();
    let _rotation_handle = rotation::spawn(
        shared.clone(),
        cfg.rpc_url.clone(),
        rotation_keypair,
        program_id,
        cfg.rotation_interval_secs,
        shutdown_rx,
    );

    let app = Router::new()
        .route("/health", get(handlers::health::handler))
        .route("/credentials", post(handlers::issue_credential::handler))
        .route("/credentials/{wallet}", get(handlers::get_credential::handler))
        .route("/wallets", post(handlers::add_wallet::handler))
        .route("/proofs/membership/{wallet}", get(handlers::get_proof::handler))
        .route("/proofs/sanctions/{wallet}", get(handlers::get_sanctions_proof::handler))
        .route("/roots", get(handlers::get_roots::handler))
        .route("/roots/publish", post(handlers::publish::handler))
        .layer(Extension(RpcUrl(cfg.rpc_url)))
        .layer(Extension(KeypairBytes(keypair_json)))
        .layer(Extension(ProgramId(program_id)))
        .with_state(shared);

    let listener = tokio::net::TcpListener::bind(cfg.listen_addr).await.unwrap();
    tracing::info!("listening on {}", cfg.listen_addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(shutdown_tx))
        .await
        .unwrap();
}

async fn shutdown_signal(shutdown_tx: watch::Sender<()>) {
    tokio::signal::ctrl_c().await.ok();
    tracing::info!("shutdown signal received");
    let _ = shutdown_tx.send(());
}
