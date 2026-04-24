mod build;
mod chain;
mod config;
mod convert;
mod error;
mod fetch;

use std::sync::Arc;
use std::time::Duration;

use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::Signer;
use zksettle_rpc::{RealSolanaRpc, SolanaRpc};

use config::Config;

#[tokio::main]
async fn main() {
    let cfg = Config::from_env();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| format!("sanctions_updater={}", cfg.log_level).into()),
        )
        .init();

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
        interval_secs = cfg.update_interval_secs,
        mock = cfg.mock_sanctions,
        "starting sanctions updater"
    );

    let rpc: Arc<dyn SolanaRpc> = Arc::new(RealSolanaRpc::new(cfg.rpc_url.clone()));

    let mut registered = match chain::is_issuer_registered(rpc.as_ref(), &keypair.pubkey(), &program_id) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(%e, "could not probe issuer PDA, assuming not registered");
            false
        }
    };

    let interval = Duration::from_secs(cfg.update_interval_secs);
    let keypair_bytes = keypair_json;

    loop {
        match run_tick(&cfg, rpc.clone(), &keypair_bytes, &program_id, registered).await {
            Ok(result) => {
                if result.did_register {
                    registered = true;
                    tracing::info!(slot = result.slot, "issuer registered on-chain");
                } else {
                    tracing::info!(slot = result.slot, "sanctions root updated on-chain");
                }
            }
            Err(e) => {
                tracing::error!(%e, "sanctions update tick failed");
            }
        }

        tokio::select! {
            _ = tokio::time::sleep(interval) => {}
            _ = tokio::signal::ctrl_c() => {
                tracing::info!("shutdown signal received");
                return;
            }
        }
    }
}

async fn run_tick(
    cfg: &Config,
    rpc: Arc<dyn SolanaRpc>,
    keypair_bytes: &[u8],
    program_id: &Pubkey,
    registered: bool,
) -> Result<chain::PublishResult, error::UpdaterError> {
    let wallets = fetch::fetch_sanctioned_wallets(cfg).await?;
    tracing::info!(count = wallets.len(), "fetched sanctioned wallets");

    let (_tree, root_bytes) = build::build_sanctions_tree(&wallets)?;

    let result = {
        let kb = keypair_bytes.to_vec();
        let pid = *program_id;
        tokio::task::spawn_blocking(move || {
            chain::publish_sanctions_root(rpc.as_ref(), &kb, &pid, root_bytes, registered)
        })
        .await
        .map_err(|e| error::UpdaterError::Chain(format!("task panicked: {e}")))?
    }?;

    Ok(result)
}
