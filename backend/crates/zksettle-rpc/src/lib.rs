//! SolanaRpc trait + real + mock impls.

use solana_sdk::instruction::Instruction;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signature};
use thiserror::Error;

pub mod real;

#[cfg(any(test, feature = "test-util"))]
pub mod mock;

pub use real::RealSolanaRpc;

#[cfg(any(test, feature = "test-util"))]
pub use mock::MockSolanaRpc;

#[derive(Debug, Error)]
pub enum RpcError {
    #[error("rpc call failed: {0}")]
    Call(String),
    #[error("tx confirmed but status not found for signature {0}")]
    MissingStatus(Signature),
}

/// Narrow, synchronous RPC surface shared by off-chain publishers.
///
/// `send_and_confirm` intentionally bundles blockhash fetch, signing,
/// send, confirmation, and status lookup — the same sequence every current
/// caller performs inline — so tests only mock one call per transaction.
pub trait SolanaRpc: Send + Sync {
    /// Returns `Ok(None)` when the account does not exist at `confirmed` commitment.
    fn get_account_data(&self, pubkey: &Pubkey) -> Result<Option<Vec<u8>>, RpcError>;

    /// Signs, sends, and confirms a single-instruction transaction.
    /// Returns the signature and the slot the transaction landed in.
    fn send_and_confirm(
        &self,
        ix: Instruction,
        signer: &Keypair,
    ) -> Result<(Signature, u64), RpcError>;
}
