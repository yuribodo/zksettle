use anchor_lang::prelude::*;
use gnark_verifier_solana::{proof::GnarkProof, verifier::GnarkVerifier, witness::GnarkWitness};

use crate::error::ZkSettleError;
use crate::generated_vk::VK;

// gnark-verifier-solana serializes a witness as a 12-byte header followed by
// `nr_pubinputs` 32-byte field elements.
const GNARK_WITNESS_HEADER_LEN: usize = 12;

pub(crate) const fn expected_witness_len(nr_inputs: usize) -> usize {
    GNARK_WITNESS_HEADER_LEN + nr_inputs * 32
}

/// Split `proof_and_witness` into `(proof_bytes, witness_bytes)` or fail with
/// `MalformedProof` if the buffer cannot fit both a non-empty proof and the
/// fixed-size witness.
fn split_proof_and_witness(data: &[u8], witness_len: usize) -> Result<(&[u8], &[u8])> {
    // Equal length would leave proof_bytes empty; reject alongside too-short input.
    if data.len() <= witness_len {
        return err!(ZkSettleError::MalformedProof);
    }
    Ok(data.split_at(data.len() - witness_len))
}

#[derive(Accounts)]
pub struct VerifyProof {}

pub fn handler(_ctx: Context<VerifyProof>, proof_and_witness: Vec<u8>) -> Result<()> {
    const NR_INPUTS: usize = VK.nr_pubinputs;
    const N_COMMITMENTS: usize = VK.commitment_keys.len();

    let witness_len = expected_witness_len(NR_INPUTS);
    let (proof_bytes, witness_bytes) = split_proof_and_witness(&proof_and_witness, witness_len)?;

    let proof = GnarkProof::<N_COMMITMENTS>::from_bytes(proof_bytes).map_err(|e| {
        msg!("Gnark proof parse error: {:?}", e);
        error!(ZkSettleError::MalformedProof)
    })?;

    let witness = GnarkWitness::from_bytes(witness_bytes).map_err(|e| {
        msg!("Gnark witness parse error: {:?}", e);
        error!(ZkSettleError::MalformedProof)
    })?;

    let mut verifier: GnarkVerifier<NR_INPUTS> = GnarkVerifier::new(&VK);

    verifier.verify(proof, witness).map_err(|e| {
        msg!("Proof verification failed: {:?}", e);
        error!(ZkSettleError::ProofInvalid)
    })?;

    msg!("Proof verified");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::error::ERROR_CODE_OFFSET;

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
}
