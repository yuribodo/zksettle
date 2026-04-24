use solana_rpc_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::instruction::Instruction;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signature};
use solana_sdk::signer::Signer;
use solana_sdk::transaction::Transaction;

use crate::{RpcError, SolanaRpc};

/// Production `SolanaRpc` wrapping `solana_rpc_client::RpcClient`.
pub struct RealSolanaRpc {
    client: RpcClient,
}

impl RealSolanaRpc {
    pub fn new(rpc_url: impl Into<String>) -> Self {
        Self {
            client: RpcClient::new(rpc_url.into()),
        }
    }

    pub fn from_client(client: RpcClient) -> Self {
        Self { client }
    }
}

impl SolanaRpc for RealSolanaRpc {
    fn get_account_data(&self, pubkey: &Pubkey) -> Result<Option<Vec<u8>>, RpcError> {
        let resp = self
            .client
            .get_account_with_commitment(pubkey, CommitmentConfig::confirmed())
            .map_err(|e| RpcError::Call(e.to_string()))?;
        Ok(resp.value.map(|account| account.data))
    }

    fn send_and_confirm(
        &self,
        ix: Instruction,
        signer: &Keypair,
    ) -> Result<(Signature, u64), RpcError> {
        let blockhash = self
            .client
            .get_latest_blockhash()
            .map_err(|e| RpcError::Call(e.to_string()))?;
        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&signer.pubkey()),
            &[signer],
            blockhash,
        );
        let sig = self
            .client
            .send_and_confirm_transaction(&tx)
            .map_err(|e| RpcError::Call(e.to_string()))?;
        tracing::info!(%sig, "tx confirmed");
        let statuses = self
            .client
            .get_signature_statuses(&[sig])
            .map_err(|e| RpcError::Call(format!("get_signature_statuses: {e}")))?;
        let slot = statuses
            .value
            .first()
            .and_then(|s| s.as_ref())
            .ok_or(RpcError::MissingStatus(sig))?
            .slot;
        Ok((sig, slot))
    }
}
