use anchor_lang::prelude::*;

use crate::error::ZkSettleError;

const GNARK_WITNESS_HEADER_LEN: usize = 12;

pub const EPOCH_LEN_SECS: i64 = 86_400;
pub const MAX_EPOCH_LAG: u64 = 1;

pub(crate) const fn expected_witness_len(nr_inputs: usize) -> usize {
    GNARK_WITNESS_HEADER_LEN + nr_inputs * 32
}

pub(crate) fn validate_epoch(unix_timestamp: i64, epoch: u64) -> Result<()> {
    require!(unix_timestamp >= 0, ZkSettleError::NegativeClock);
    let current_epoch = (unix_timestamp / EPOCH_LEN_SECS) as u64;
    require!(epoch <= current_epoch, ZkSettleError::EpochInFuture);
    require!(
        current_epoch.saturating_sub(epoch) <= MAX_EPOCH_LAG,
        ZkSettleError::EpochStale
    );
    Ok(())
}

pub(crate) fn split_proof_and_witness(data: &[u8], witness_len: usize) -> Result<(&[u8], &[u8])> {
    if data.len() <= witness_len {
        return err!(ZkSettleError::MalformedProof);
    }
    Ok(data.split_at(data.len() - witness_len))
}

pub fn pubkey_to_limbs(pk: &Pubkey) -> ([u8; 32], [u8; 32]) {
    let bytes = pk.to_bytes();
    let mut hi = [0u8; 32];
    let mut lo = [0u8; 32];
    hi[16..32].copy_from_slice(&bytes[0..16]);
    lo[16..32].copy_from_slice(&bytes[16..32]);
    (lo, hi)
}

pub fn u64_to_field_bytes(x: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[24..32].copy_from_slice(&x.to_be_bytes());
    out
}
