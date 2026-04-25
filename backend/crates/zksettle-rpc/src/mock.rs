//! In-memory `SolanaRpc` for tests. Thread-safe so Axum handlers can share it.
//!
//! Feature-gated behind `test-util` so consumers opt in per their
//! dev-dependencies: `zksettle-rpc = { path = "...", features = ["test-util"] }`.

use std::collections::HashMap;
use std::sync::Mutex;

use solana_sdk::instruction::Instruction;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signature};

use crate::{RpcError, SolanaRpc};

pub struct MockSolanaRpc {
    accounts: Mutex<HashMap<Pubkey, Vec<u8>>>,
    sent: Mutex<Vec<Instruction>>,
    next_slot: Mutex<u64>,
    pending_error: Mutex<Option<RpcError>>,
}

impl MockSolanaRpc {
    pub fn new() -> Self {
        Self {
            accounts: Mutex::new(HashMap::new()),
            sent: Mutex::new(Vec::new()),
            next_slot: Mutex::new(1_000),
            pending_error: Mutex::new(None),
        }
    }

    /// Prime an account's data so the next `get_account_data` call returns it.
    pub fn set_account(&self, pubkey: Pubkey, data: Vec<u8>) {
        self.accounts.lock().unwrap().insert(pubkey, data);
    }

    pub fn clear_account(&self, pubkey: &Pubkey) {
        self.accounts.lock().unwrap().remove(pubkey);
    }

    /// Cause the next `send_and_confirm` call to return this error, then reset.
    pub fn queue_error(&self, error: RpcError) {
        *self.pending_error.lock().unwrap() = Some(error);
    }

    pub fn sent_instructions(&self) -> Vec<Instruction> {
        self.sent.lock().unwrap().clone()
    }

    pub fn send_count(&self) -> usize {
        self.sent.lock().unwrap().len()
    }
}

impl Default for MockSolanaRpc {
    fn default() -> Self {
        Self::new()
    }
}

impl SolanaRpc for MockSolanaRpc {
    fn get_account_data(&self, pubkey: &Pubkey) -> Result<Option<Vec<u8>>, RpcError> {
        Ok(self.accounts.lock().unwrap().get(pubkey).cloned())
    }

    fn send_and_confirm(
        &self,
        ix: Instruction,
        _signer: &Keypair,
    ) -> Result<(Signature, u64), RpcError> {
        if let Some(err) = self.pending_error.lock().unwrap().take() {
            return Err(err);
        }
        self.sent.lock().unwrap().push(ix);
        let mut slot = self.next_slot.lock().unwrap();
        let current = *slot;
        *slot += 1;
        Ok((Signature::default(), current))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_ix() -> Instruction {
        Instruction {
            program_id: Pubkey::new_unique(),
            accounts: vec![],
            data: vec![],
        }
    }

    #[test]
    fn get_account_data_returns_none_for_missing_pubkey() {
        let rpc = MockSolanaRpc::new();
        assert_eq!(rpc.get_account_data(&Pubkey::new_unique()).unwrap(), None);
    }

    #[test]
    fn get_account_data_returns_primed_bytes() {
        let rpc = MockSolanaRpc::new();
        let pk = Pubkey::new_unique();
        rpc.set_account(pk, vec![1, 2, 3]);
        assert_eq!(rpc.get_account_data(&pk).unwrap(), Some(vec![1, 2, 3]));
    }

    #[test]
    fn clear_account_reverts_to_missing() {
        let rpc = MockSolanaRpc::new();
        let pk = Pubkey::new_unique();
        rpc.set_account(pk, vec![9]);
        rpc.clear_account(&pk);
        assert_eq!(rpc.get_account_data(&pk).unwrap(), None);
    }

    #[test]
    fn send_and_confirm_records_instruction_and_advances_slot() {
        let rpc = MockSolanaRpc::new();
        let kp = Keypair::new();

        let (_sig, slot_a) = rpc.send_and_confirm(dummy_ix(), &kp).unwrap();
        let (_sig, slot_b) = rpc.send_and_confirm(dummy_ix(), &kp).unwrap();

        assert_eq!(rpc.send_count(), 2);
        assert!(slot_b > slot_a, "slot must advance between sends");
    }

    #[test]
    fn queued_error_fires_once_then_resets() {
        let rpc = MockSolanaRpc::new();
        let kp = Keypair::new();
        rpc.queue_error(RpcError::Call("simulated".into()));

        assert!(rpc.send_and_confirm(dummy_ix(), &kp).is_err());
        assert_eq!(rpc.send_count(), 0, "errored send must not be recorded");

        // next call succeeds because the queued error was consumed
        assert!(rpc.send_and_confirm(dummy_ix(), &kp).is_ok());
        assert_eq!(rpc.send_count(), 1);
    }
}
