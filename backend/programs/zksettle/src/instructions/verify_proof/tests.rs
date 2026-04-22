#![cfg(test)]

use anchor_lang::error::ERROR_CODE_OFFSET;
use anchor_lang::prelude::*;
use gnark_verifier_solana::witness::GnarkWitness;

use crate::error::ZkSettleError;
use crate::state::{
    AMOUNT_IDX, EPOCH_IDX, MERKLE_ROOT_IDX, MINT_HI_IDX, MINT_LO_IDX,
    NULLIFIER_IDX, RECIPIENT_HI_IDX, RECIPIENT_LO_IDX,
};

use super::bindings::{SANCTIONS_ROOT_IDX, JURISDICTION_ROOT_IDX, TIMESTAMP_IDX};

use super::bindings::{check_bindings, BindingInputs};
use super::helpers::{
    expected_witness_len, pubkey_to_limbs, split_proof_and_witness, u64_to_field_bytes,
    validate_epoch, EPOCH_LEN_SECS, MAX_EPOCH_LAG,
};

fn err_code<T: std::fmt::Debug>(r: Result<T>) -> u32 {
    match r {
        Err(anchor_lang::error::Error::AnchorError(e)) => e.error_code_number,
        other => panic!("expected AnchorError, got {other:?}"),
    }
}

#[test]
fn rejects_empty_proof_at_exact_witness_len() {
    let witness_len = expected_witness_len(4);
    let buf = vec![0u8; witness_len];
    assert_eq!(
        err_code(split_proof_and_witness(&buf, witness_len)),
        ERROR_CODE_OFFSET + ZkSettleError::MalformedProof as u32,
    );
}

#[test]
fn rejects_short_buffer() {
    let witness_len = expected_witness_len(4);
    let buf = vec![0u8; witness_len - 1];
    assert_eq!(
        err_code(split_proof_and_witness(&buf, witness_len)),
        ERROR_CODE_OFFSET + ZkSettleError::MalformedProof as u32,
    );
}

#[test]
fn splits_one_byte_proof() {
    let witness_len = expected_witness_len(2);
    let mut buf = vec![0u8; witness_len + 1];
    buf[0] = 0xaa;
    let (proof, witness) = split_proof_and_witness(&buf, witness_len).unwrap();
    assert_eq!(proof, &[0xaa]);
    assert_eq!(witness.len(), witness_len);
}

#[test]
fn u64_field_bytes_are_big_endian() {
    let b = u64_to_field_bytes(0x0102_0304_0506_0708);
    assert_eq!(&b[..24], &[0u8; 24]);
    assert_eq!(&b[24..], &[1, 2, 3, 4, 5, 6, 7, 8]);
}

#[test]
fn pubkey_limbs_roundtrip() {
    let mut raw = [0u8; 32];
    for (i, b) in raw.iter_mut().enumerate() {
        *b = i as u8;
    }
    let pk = Pubkey::new_from_array(raw);
    let (lo, hi) = pubkey_to_limbs(&pk);
    assert_eq!(&hi[..16], &[0u8; 16]);
    assert_eq!(&hi[16..], &raw[0..16]);
    assert_eq!(&lo[..16], &[0u8; 16]);
    assert_eq!(&lo[16..], &raw[16..32]);
}

mod bindings {
    use super::*;

    fn witness_for(
        root: [u8; 32],
        nullifier: [u8; 32],
        mint: &Pubkey,
        epoch: u64,
        recipient: &Pubkey,
        amount: u64,
        sanctions_root: [u8; 32],
        jurisdiction_root: [u8; 32],
        timestamp: u64,
    ) -> GnarkWitness<8> {
        let (mint_lo, mint_hi) = pubkey_to_limbs(mint);
        let (rcpt_lo, rcpt_hi) = pubkey_to_limbs(recipient);
        let mut entries = [[0u8; 32]; 8];
        entries[MERKLE_ROOT_IDX] = root;
        entries[NULLIFIER_IDX] = nullifier;
        entries[MINT_LO_IDX] = mint_lo;
        entries[MINT_HI_IDX] = mint_hi;
        entries[EPOCH_IDX] = u64_to_field_bytes(epoch);
        entries[RECIPIENT_LO_IDX] = rcpt_lo;
        entries[RECIPIENT_HI_IDX] = rcpt_hi;
        entries[AMOUNT_IDX] = u64_to_field_bytes(amount);
        let _ = (sanctions_root, jurisdiction_root, timestamp);
        GnarkWitness { entries }
    }

    struct Sample {
        root: [u8; 32],
        nul: [u8; 32],
        mint: Pubkey,
        epoch: u64,
        rcpt: Pubkey,
        amt: u64,
        sanctions_root: [u8; 32],
        jurisdiction_root: [u8; 32],
        timestamp: u64,
    }

    fn sample() -> Sample {
        Sample {
            root: [1u8; 32],
            nul: [2u8; 32],
            mint: Pubkey::new_unique(),
            epoch: 42,
            rcpt: Pubkey::new_unique(),
            amt: 1_000,
            sanctions_root: [3u8; 32],
            jurisdiction_root: [4u8; 32],
            timestamp: 1_700_000_000,
        }
    }

    impl Sample {
        fn inputs(&self) -> BindingInputs<'_> {
            BindingInputs {
                merkle_root: &self.root,
                nullifier_hash: &self.nul,
                mint: &self.mint,
                epoch: self.epoch,
                recipient: &self.rcpt,
                amount: self.amt,
                sanctions_root: &self.sanctions_root,
                jurisdiction_root: &self.jurisdiction_root,
                timestamp: self.timestamp,
            }
        }

        fn witness(&self) -> GnarkWitness<8> {
            witness_for(
                self.root,
                self.nul,
                &self.mint,
                self.epoch,
                &self.rcpt,
                self.amt,
                self.sanctions_root,
                self.jurisdiction_root,
                self.timestamp,
            )
        }
    }

    #[test]
    fn accepts_matching_tuple() {
        let s = sample();
        assert!(check_bindings(&s.witness(), &s.inputs()).is_ok());
    }

    #[test]
    fn rejects_root_mismatch() {
        let s = sample();
        let other = [9u8; 32];
        let mut inputs = s.inputs();
        inputs.merkle_root = &other;
        assert_eq!(
            err_code(check_bindings(&s.witness(), &inputs)),
            ERROR_CODE_OFFSET + ZkSettleError::MerkleRootMismatch as u32,
        );
    }

    #[test]
    fn rejects_nullifier_mismatch() {
        let s = sample();
        let other = [9u8; 32];
        let mut inputs = s.inputs();
        inputs.nullifier_hash = &other;
        assert_eq!(
            err_code(check_bindings(&s.witness(), &inputs)),
            ERROR_CODE_OFFSET + ZkSettleError::NullifierMismatch as u32,
        );
    }

    #[test]
    fn rejects_mint_mismatch() {
        let s = sample();
        let other = Pubkey::new_unique();
        let mut inputs = s.inputs();
        inputs.mint = &other;
        assert_eq!(
            err_code(check_bindings(&s.witness(), &inputs)),
            ERROR_CODE_OFFSET + ZkSettleError::MintMismatch as u32,
        );
    }

    #[test]
    fn rejects_epoch_mismatch() {
        let s = sample();
        let mut inputs = s.inputs();
        inputs.epoch += 1;
        assert_eq!(
            err_code(check_bindings(&s.witness(), &inputs)),
            ERROR_CODE_OFFSET + ZkSettleError::EpochMismatch as u32,
        );
    }

    #[test]
    fn rejects_recipient_mismatch() {
        let s = sample();
        let other = Pubkey::new_unique();
        let mut inputs = s.inputs();
        inputs.recipient = &other;
        assert_eq!(
            err_code(check_bindings(&s.witness(), &inputs)),
            ERROR_CODE_OFFSET + ZkSettleError::RecipientMismatch as u32,
        );
    }

    #[test]
    fn rejects_amount_mismatch() {
        let s = sample();
        let mut inputs = s.inputs();
        inputs.amount += 1;
        assert_eq!(
            err_code(check_bindings(&s.witness(), &inputs)),
            ERROR_CODE_OFFSET + ZkSettleError::AmountMismatch as u32,
        );
    }

}

mod bindings_11 {
    use super::*;

    fn witness_for_11(
        root: [u8; 32],
        nullifier: [u8; 32],
        mint: &Pubkey,
        epoch: u64,
        recipient: &Pubkey,
        amount: u64,
        sanctions_root: [u8; 32],
        jurisdiction_root: [u8; 32],
        timestamp: u64,
    ) -> GnarkWitness<11> {
        let (mint_lo, mint_hi) = pubkey_to_limbs(mint);
        let (rcpt_lo, rcpt_hi) = pubkey_to_limbs(recipient);
        let mut entries = [[0u8; 32]; 11];
        entries[MERKLE_ROOT_IDX] = root;
        entries[NULLIFIER_IDX] = nullifier;
        entries[MINT_LO_IDX] = mint_lo;
        entries[MINT_HI_IDX] = mint_hi;
        entries[EPOCH_IDX] = u64_to_field_bytes(epoch);
        entries[RECIPIENT_LO_IDX] = rcpt_lo;
        entries[RECIPIENT_HI_IDX] = rcpt_hi;
        entries[AMOUNT_IDX] = u64_to_field_bytes(amount);
        entries[SANCTIONS_ROOT_IDX] = sanctions_root;
        entries[JURISDICTION_ROOT_IDX] = jurisdiction_root;
        entries[TIMESTAMP_IDX] = u64_to_field_bytes(timestamp);
        GnarkWitness { entries }
    }

    struct Sample {
        root: [u8; 32],
        nul: [u8; 32],
        mint: Pubkey,
        epoch: u64,
        rcpt: Pubkey,
        amt: u64,
        sanctions_root: [u8; 32],
        jurisdiction_root: [u8; 32],
        timestamp: u64,
    }

    fn sample() -> Sample {
        Sample {
            root: [1u8; 32],
            nul: [2u8; 32],
            mint: Pubkey::new_unique(),
            epoch: 42,
            rcpt: Pubkey::new_unique(),
            amt: 1_000,
            sanctions_root: [3u8; 32],
            jurisdiction_root: [4u8; 32],
            timestamp: 1_700_000_000,
        }
    }

    impl Sample {
        fn inputs(&self) -> BindingInputs<'_> {
            BindingInputs {
                merkle_root: &self.root,
                nullifier_hash: &self.nul,
                mint: &self.mint,
                epoch: self.epoch,
                recipient: &self.rcpt,
                amount: self.amt,
                sanctions_root: &self.sanctions_root,
                jurisdiction_root: &self.jurisdiction_root,
                timestamp: self.timestamp,
            }
        }

        fn witness(&self) -> GnarkWitness<11> {
            witness_for_11(
                self.root,
                self.nul,
                &self.mint,
                self.epoch,
                &self.rcpt,
                self.amt,
                self.sanctions_root,
                self.jurisdiction_root,
                self.timestamp,
            )
        }
    }

    #[test]
    fn accepts_matching_11_tuple() {
        let s = sample();
        assert!(check_bindings(&s.witness(), &s.inputs()).is_ok());
    }

    #[test]
    fn rejects_sanctions_root_mismatch() {
        let s = sample();
        let other = [99u8; 32];
        let mut inputs = s.inputs();
        inputs.sanctions_root = &other;
        assert_eq!(
            err_code(check_bindings(&s.witness(), &inputs)),
            ERROR_CODE_OFFSET + ZkSettleError::SanctionsRootMismatch as u32,
        );
    }

    #[test]
    fn rejects_jurisdiction_root_mismatch() {
        let s = sample();
        let other = [99u8; 32];
        let mut inputs = s.inputs();
        inputs.jurisdiction_root = &other;
        assert_eq!(
            err_code(check_bindings(&s.witness(), &inputs)),
            ERROR_CODE_OFFSET + ZkSettleError::JurisdictionRootMismatch as u32,
        );
    }

    #[test]
    fn rejects_timestamp_mismatch() {
        let s = sample();
        let mut inputs = s.inputs();
        inputs.timestamp += 1;
        assert_eq!(
            err_code(check_bindings(&s.witness(), &inputs)),
            ERROR_CODE_OFFSET + ZkSettleError::TimestampMismatch as u32,
        );
    }
}

mod epoch {
    use super::*;

    #[test]
    fn accepts_current_epoch() {
        let ts = EPOCH_LEN_SECS * 10;
        assert!(validate_epoch(ts, 10).is_ok());
    }

    #[test]
    fn accepts_one_behind_at_max_lag() {
        let ts = EPOCH_LEN_SECS * 10;
        assert!(validate_epoch(ts, 10 - MAX_EPOCH_LAG).is_ok());
    }

    #[test]
    fn rejects_future() {
        let ts = EPOCH_LEN_SECS * 10;
        assert_eq!(
            err_code(validate_epoch(ts, 11)),
            ERROR_CODE_OFFSET + ZkSettleError::EpochInFuture as u32,
        );
    }

    #[test]
    fn rejects_stale() {
        let ts = EPOCH_LEN_SECS * 10;
        assert_eq!(
            err_code(validate_epoch(ts, 10 - MAX_EPOCH_LAG - 1)),
            ERROR_CODE_OFFSET + ZkSettleError::EpochStale as u32,
        );
    }

    #[test]
    fn boundary_exactly_at_max_lag() {
        let ts = EPOCH_LEN_SECS * 5;
        assert!(validate_epoch(ts, 5 - MAX_EPOCH_LAG).is_ok());
    }

    #[test]
    fn boundary_one_past_max_lag() {
        let ts = EPOCH_LEN_SECS * 5;
        assert_eq!(
            err_code(validate_epoch(ts, 5 - MAX_EPOCH_LAG - 1)),
            ERROR_CODE_OFFSET + ZkSettleError::EpochStale as u32,
        );
    }

    #[test]
    fn rejects_negative_clock() {
        assert_eq!(
            err_code(validate_epoch(-1, 0)),
            ERROR_CODE_OFFSET + ZkSettleError::NegativeClock as u32,
        );
    }

    #[test]
    fn at_zero_timestamp() {
        assert!(validate_epoch(0, 0).is_ok());
    }

    #[test]
    fn expected_witness_len_formula() {
        assert_eq!(expected_witness_len(8), 268);
    }

    #[test]
    fn expected_witness_len_zero_inputs() {
        assert_eq!(expected_witness_len(0), 12);
    }
}
