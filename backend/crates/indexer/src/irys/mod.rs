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
        // Delegate to the inherent impl (retry logic, dry-run branch, tracing).
        client::IrysClient::upload(self, event).await
    }
}
