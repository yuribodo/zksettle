use reqwest::Client;
use tracing::{info, warn};
use zksettle_types::ProofSettled;

use crate::error::IndexerError;
use crate::irys::types::{build_tags, AttestationRecord};

pub struct IrysClient {
    node_url: String,
    http: Client,
    dry_run: bool,
}

impl IrysClient {
    pub fn new(node_url: String, _wallet_key: Option<&str>, http: Client) -> Self {
        let dry_run = _wallet_key.is_none();
        if dry_run {
            info!("irys client in dry-run mode (no wallet key)");
        }
        Self {
            node_url,
            http,
            dry_run,
        }
    }

    #[mutants::skip]
    pub async fn upload(&self, event: &ProofSettled) -> Result<String, IndexerError> {
        let record = AttestationRecord::from(event);
        let tags = build_tags(event);

        if self.dry_run {
            info!(
                nullifier = hex::encode(event.nullifier_hash),
                slot = event.slot,
                tags = tags.len(),
                "dry-run: would upload attestation"
            );
            return Ok("dry-run".into());
        }

        let body = serde_json::to_vec(&record)
            .map_err(|e| IndexerError::IrysUpload(e.to_string()))?;

        let url = format!("{}/tx/solana", self.node_url);

        let mut last_err = None;
        for attempt in 0..3u32 {
            if attempt > 0 {
                let delay = std::time::Duration::from_millis(500 * 2u64.pow(attempt));
                tokio::time::sleep(delay).await;
            }

            match self.http.post(&url)
                .header("Content-Type", "application/json")
                .body(body.clone())
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => {
                    let tx_id = resp
                        .text()
                        .await
                        .unwrap_or_else(|_| "unknown".into());
                    info!(tx_id = %tx_id, "uploaded attestation to irys");
                    return Ok(tx_id);
                }
                Ok(resp) if resp.status().is_server_error() => {
                    let status = resp.status();
                    warn!(attempt, %status, "irys 5xx, retrying");
                    last_err = Some(format!("irys returned {status}"));
                }
                Ok(resp) => {
                    let status = resp.status();
                    let text = resp.text().await.unwrap_or_default();
                    return Err(IndexerError::IrysUpload(format!("{status}: {text}")));
                }
                Err(e) => {
                    warn!(attempt, error = %e, "irys request failed, retrying");
                    last_err = Some(e.to_string());
                }
            }
        }

        Err(IndexerError::IrysUpload(
            last_err.unwrap_or_else(|| "unknown error".into()),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_event() -> ProofSettled {
        ProofSettled {
            issuer: [1u8; 32],
            nullifier_hash: [2u8; 32],
            merkle_root: [3u8; 32],
            sanctions_root: [4u8; 32],
            jurisdiction_root: [5u8; 32],
            mint: [6u8; 32],
            recipient: [7u8; 32],
            amount: 1_000_000,
            epoch: 1,
            timestamp: 1_700_000_000,
            slot: 42,
            payer: [8u8; 32],
        }
    }

    #[tokio::test]
    async fn dry_run_when_no_wallet_key_returns_dry_run_marker() {
        let client = IrysClient::new("http://unused".into(), None, Client::new());
        let tx = client.upload(&fixture_event()).await.unwrap();
        assert_eq!(tx, "dry-run");
    }

    #[tokio::test]
    async fn live_mode_does_not_short_circuit_to_dry_run() {
        // wallet key present -> dry_run flag is false. Pointing at an
        // unreachable address (port 0) the upload must NOT return "dry-run";
        // the real branch is taken and fails with IrysUpload after retries.
        let client = IrysClient::new(
            "http://127.0.0.1:1".into(),
            Some("any-key"),
            Client::builder()
                .timeout(std::time::Duration::from_millis(50))
                .connect_timeout(std::time::Duration::from_millis(50))
                .build()
                .unwrap(),
        );
        let result = client.upload(&fixture_event()).await;
        assert!(matches!(result, Err(IndexerError::IrysUpload(_))));
    }
}
