pub mod client;
pub mod types;

use async_trait::async_trait;
use zksettle_types::ProofSettled;

use crate::error::IndexerError;

/// Abstraction over the Irys upload leg, so the webhook handler can be
/// tested without hitting a live Irys node.
#[async_trait]
pub trait IrysUploader: Send + Sync {
    async fn upload(&self, event: &ProofSettled) -> Result<String, IndexerError>;
}

#[async_trait]
impl IrysUploader for client::IrysClient {
    async fn upload(&self, event: &ProofSettled) -> Result<String, IndexerError> {
        client::IrysClient::upload(self, event).await
    }
}

#[cfg(any(test, feature = "test-util"))]
pub mod mock {
    use std::sync::Mutex;

    use super::*;

    /// In-memory `IrysUploader` for tests. Records uploads, lets tests
    /// inject one-shot errors, and returns a configurable canned tx_id.
    pub struct MockIrysUploader {
        recorded: Mutex<Vec<ProofSettled>>,
        tx_id: Mutex<String>,
        pending_error: Mutex<Option<IndexerError>>,
    }

    impl MockIrysUploader {
        pub fn new() -> Self {
            Self {
                recorded: Mutex::new(Vec::new()),
                tx_id: Mutex::new("mock-tx-id".into()),
                pending_error: Mutex::new(None),
            }
        }

        pub fn set_tx_id(&self, id: impl Into<String>) {
            *self.tx_id.lock().unwrap() = id.into();
        }

        pub fn queue_error(&self, error: IndexerError) {
            *self.pending_error.lock().unwrap() = Some(error);
        }

        pub fn upload_count(&self) -> usize {
            self.recorded.lock().unwrap().len()
        }

        pub fn recorded_uploads(&self) -> Vec<ProofSettled> {
            self.recorded.lock().unwrap().clone()
        }
    }

    impl Default for MockIrysUploader {
        fn default() -> Self {
            Self::new()
        }
    }

    #[async_trait]
    impl IrysUploader for MockIrysUploader {
        async fn upload(&self, event: &ProofSettled) -> Result<String, IndexerError> {
            if let Some(err) = self.pending_error.lock().unwrap().take() {
                return Err(err);
            }
            self.recorded.lock().unwrap().push(event.clone());
            Ok(self.tx_id.lock().unwrap().clone())
        }
    }
}

#[cfg(any(test, feature = "test-util"))]
pub use mock::MockIrysUploader;

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
    async fn mock_records_uploads_and_returns_tx_id() {
        let mock = MockIrysUploader::new();
        mock.set_tx_id("custom-tx");

        let event = fixture_event();
        let tx = mock.upload(&event).await.unwrap();

        assert_eq!(tx, "custom-tx");
        assert_eq!(mock.upload_count(), 1);
        assert_eq!(mock.recorded_uploads()[0].nullifier_hash, [2u8; 32]);
    }

    #[tokio::test]
    async fn mock_default_tx_id_is_mock_tx_id() {
        let mock = MockIrysUploader::new();
        let tx = mock.upload(&fixture_event()).await.unwrap();
        assert_eq!(tx, "mock-tx-id");
    }

    #[tokio::test]
    async fn queued_error_fires_once_and_does_not_record() {
        let mock = MockIrysUploader::new();
        mock.queue_error(IndexerError::IrysUpload("simulated".into()));

        let err = mock.upload(&fixture_event()).await.unwrap_err();
        assert!(matches!(err, IndexerError::IrysUpload(_)));
        assert_eq!(mock.upload_count(), 0);

        mock.upload(&fixture_event()).await.unwrap();
        assert_eq!(mock.upload_count(), 1);
    }

    /// Exercises the `IrysUploader` trait impl on `IrysClient` through a
    /// `dyn IrysUploader` indirection. The inherent `IrysClient::upload`
    /// already has its own dry-run test, but the trait-impl wrapper at
    /// `mod.rs:19` is a separate function that mutation testing flagged as
    /// uncovered: replacing the body with `Ok(String::new())` or
    /// `Ok("xyzzy".into())` would otherwise pass undetected. Asserting the
    /// exact `"dry-run"` marker (not just `is_ok()`) kills both.
    #[tokio::test]
    async fn trait_dispatch_on_irys_client_returns_dry_run_marker() {
        use std::sync::Arc;

        let uploader: Arc<dyn IrysUploader> = Arc::new(client::IrysClient::new(
            "http://unused".into(),
            None,
            reqwest::Client::new(),
        ));
        let tx = uploader.upload(&fixture_event()).await.unwrap();
        assert_eq!(tx, "dry-run");
    }
}
