mod auth;
mod chain;
mod config;
mod convert;
mod error;
mod handlers;
mod persist;
mod rotation;
mod state;

use std::sync::Arc;
use std::time::Duration;

use axum::middleware;
use axum::routing::{get, post};
use axum::{Extension, Router};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::Signer;
use tokio::sync::{watch, RwLock, Semaphore};
use zksettle_rpc::{RealSolanaRpc, SolanaRpc};

use auth::{AllowUnauthenticated, ApiToken};
use config::{Config, SunspotConfig};
use handlers::prove_groth16::{sha256_file_hex, ProverPaths, ProverPermits};
use state::{IssuerState, PublishLock};

/// Shared Solana RPC handle for handlers + rotation task.
/// `Arc<dyn SolanaRpc>` is `Send + Sync` because the trait requires both.
#[derive(Clone)]
pub struct SharedRpc(pub Arc<dyn SolanaRpc>);
#[derive(Clone)]
pub struct KeypairBytes(pub Vec<u8>);
#[derive(Clone)]
pub struct ProgramId(pub Pubkey);
#[derive(Clone)]
pub struct StatePath(pub Option<String>);

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "issuer_service=info".into()),
        )
        .init();

    let cfg = Config::from_env();

    let keypair_json = zksettle_config::load_keypair_json(
        cfg.keypair_json.as_deref(),
        &cfg.keypair_path,
        "ISSUER_KEYPAIR_JSON",
    );
    let keypair = Keypair::try_from(keypair_json.as_slice())
        .unwrap_or_else(|e| panic!("invalid keypair bytes: {e}"));
    let program_id: Pubkey = cfg
        .program_id
        .parse()
        .unwrap_or_else(|e| panic!("invalid program ID '{}': {e}", cfg.program_id));

    let allow_unauth = std::env::var("ALLOW_UNAUTHENTICATED")
        .ok()
        .map(|v| matches!(v.to_ascii_lowercase().as_str(), "true" | "1" | "yes"))
        .unwrap_or(false);

    match (&cfg.api_token, cfg.listen_addr.ip().is_loopback(), allow_unauth) {
        (Some(_), _, _) => {}
        (None, true, _) => {
            tracing::warn!("API_TOKEN not set — bearer auth disabled on loopback");
        }
        (None, false, true) => {
            tracing::warn!(
                "API_TOKEN not set and ALLOW_UNAUTHENTICATED=true — write endpoints are anonymous"
            );
        }
        (None, false, false) => {
            panic!(
                "refusing to start: API_TOKEN not set on non-loopback address {}; \
                 set API_TOKEN or ALLOW_UNAUTHENTICATED=true",
                cfg.listen_addr
            );
        }
    }

    tracing::info!(
        authority = %keypair.pubkey(),
        %program_id,
        rpc = %cfg.rpc_url,
        listen = %cfg.listen_addr,
        rotation_secs = cfg.rotation_interval_secs,
        auth_enabled = cfg.api_token.is_some(),
        "starting issuer service"
    );

    let rpc: Arc<dyn SolanaRpc> = Arc::new(RealSolanaRpc::new(cfg.rpc_url.clone()));

    let already_registered = match chain::is_issuer_registered(rpc.as_ref(), &keypair.pubkey(), &program_id) {
        Ok(true) => {
            tracing::info!("issuer PDA exists on-chain, resuming as registered");
            true
        }
        Ok(false) => false,
        Err(e) => {
            tracing::warn!(%e, "could not probe issuer PDA, assuming not registered");
            false
        }
    };

    let mut initial_state = if let Some(ref path) = cfg.state_path {
        match persist::load(path) {
            Ok(state) => {
                tracing::info!(wallets = state.wallet_count(), "restored state from disk");
                state
            }
            Err(e) => {
                tracing::warn!(%e, "could not load persisted state, starting fresh");
                IssuerState::new()
            }
        }
    } else {
        IssuerState::new()
    };
    initial_state.registered = already_registered;
    let shared = Arc::new(RwLock::new(initial_state));
    let publish_lock: PublishLock = Arc::new(tokio::sync::Mutex::new(()));
    let (shutdown_tx, shutdown_rx) = watch::channel(());

    let rotation_keypair = Keypair::try_from(keypair_json.as_slice()).unwrap();
    let _rotation_handle = rotation::spawn(
        shared.clone(),
        rpc.clone(),
        rotation_keypair,
        program_id,
        cfg.rotation_interval_secs,
        shutdown_rx,
        publish_lock.clone(),
    );

    let public_routes = Router::new()
        .route("/health", get(handlers::health::handler))
        .route("/roots", get(handlers::get_roots::handler))
        .route(
            "/credentials/{wallet}",
            get(handlers::get_credential::handler),
        )
        .route(
            "/proofs/membership/{wallet}",
            get(handlers::get_proof::handler),
        )
        .route(
            "/proofs/sanctions/{wallet}",
            get(handlers::get_sanctions_proof::handler),
        )
        .route(
            "/proofs/jurisdiction/{wallet}",
            get(handlers::get_jurisdiction_proof::handler),
        );

    let mut protected_routes = Router::new()
        .route("/credentials", post(handlers::issue_credential::handler))
        .route(
            "/credentials/{wallet}",
            axum::routing::delete(handlers::revoke_credential::handler),
        )
        .route("/wallets", post(handlers::add_wallet::handler))
        .route("/roots/publish", post(handlers::publish::handler));

    let prover = build_prover_extensions(cfg.sunspot.as_ref());
    if let Some((paths, permits)) = prover.clone() {
        protected_routes = protected_routes
            .route(
                "/prove/groth16",
                post(handlers::prove_groth16::handler),
            )
            .layer(Extension(paths))
            .layer(Extension(permits));
    }

    if let Some(ref token) = cfg.api_token {
        protected_routes = protected_routes
            .layer(middleware::from_fn(auth::require_bearer))
            .layer(Extension(ApiToken::new(token.clone())));
    }

    let app = public_routes
        .merge(protected_routes)
        .layer(Extension(SharedRpc(rpc)))
        .layer(Extension(KeypairBytes(keypair_json)))
        .layer(Extension(ProgramId(program_id)))
        .layer(Extension(publish_lock))
        .layer(Extension(StatePath(cfg.state_path)))
        .layer(Extension(AllowUnauthenticated(allow_unauth)))
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

/// Validate Sunspot artefact paths, enforce ACIR hash pinning, and build the
/// shared `ProverPaths` + `ProverPermits` extensions. Returns `None` when no
/// Sunspot env vars are configured (route stays unregistered, rest of service
/// runs). Panics on ACIR hash drift — circuit recompiles must update the
/// pinned constant explicitly.
fn build_prover_extensions(
    sunspot: Option<&SunspotConfig>,
) -> Option<(ProverPaths, ProverPermits)> {
    let sc = sunspot?;

    for (label, path) in [
        ("bin", &sc.bin),
        ("acir", &sc.acir),
        ("ccs", &sc.ccs),
        ("pk", &sc.pk),
    ] {
        if !path.exists() {
            tracing::warn!(
                kind = label,
                path = %path.display(),
                "Sunspot artefact missing; /prove/groth16 disabled"
            );
            return None;
        }
    }

    let actual_hash = match sha256_file_hex(&sc.acir) {
        Ok(h) => h,
        Err(e) => {
            tracing::error!(
                path = %sc.acir.display(),
                error = %e,
                "could not hash ACIR; /prove/groth16 disabled"
            );
            return None;
        }
    };
    if actual_hash != sc.acir_sha256 {
        panic!(
            "ACIR hash mismatch — refusing to start.\n  expected: {}\n  got:      {}\n  path:     {}\n\
            If the circuit was recompiled, regenerate artefacts and update DEFAULT_ACIR_SHA256.",
            sc.acir_sha256,
            actual_hash,
            sc.acir.display(),
        );
    }

    tracing::info!(
        bin = %sc.bin.display(),
        acir = %sc.acir.display(),
        acir_sha256 = %actual_hash,
        ccs = %sc.ccs.display(),
        pk = %sc.pk.display(),
        max_concurrency = sc.max_concurrency,
        timeout_secs = sc.timeout_secs,
        "Sunspot prover wired; /prove/groth16 active",
    );

    let paths = ProverPaths {
        bin: sc.bin.clone(),
        acir: sc.acir.clone(),
        ccs: sc.ccs.clone(),
        pk: sc.pk.clone(),
        timeout: Duration::from_secs(sc.timeout_secs),
    };
    let permits = ProverPermits(Arc::new(Semaphore::new(sc.max_concurrency)));
    Some((paths, permits))
}
