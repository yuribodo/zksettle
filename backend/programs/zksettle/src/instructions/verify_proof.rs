use anchor_lang::prelude::*;
use gnark_verifier_solana::{proof::GnarkProof, verifier::GnarkVerifier, witness::GnarkWitness};

use crate::error::ZkSettleError;
use crate::generated_vk::VK;
use crate::state::{
    Issuer, Nullifier, ISSUER_SEED, MERKLE_ROOT_IDX, NULLIFIER_IDX, NULLIFIER_SEED,
};

// gnark-verifier-solana serializes a witness as a 12-byte header followed by
// `nr_pubinputs` 32-byte field elements.
const GNARK_WITNESS_HEADER_LEN: usize = 12;

pub(crate) const fn expected_witness_len(nr_inputs: usize) -> usize {
    GNARK_WITNESS_HEADER_LEN + nr_inputs * 32
}

// When the real compliance VK is wired in, the witness must expose at least
// MERKLE_ROOT_IDX and NULLIFIER_IDX. Fail loudly at compile time otherwise.
#[cfg(not(feature = "placeholder-vk"))]
const _: () = assert!(
    VK.nr_pubinputs > NULLIFIER_IDX,
    "real VK must expose at least MERKLE_ROOT_IDX and NULLIFIER_IDX public inputs",
);

/// Split `proof_and_witness` into `(proof_bytes, witness_bytes)` or fail with
/// `MalformedProof` if the buffer cannot fit both a non-empty proof and the
/// fixed-size witness.
fn split_proof_and_witness(data: &[u8], witness_len: usize) -> Result<(&[u8], &[u8])> {
    if data.len() <= witness_len {
        return err!(ZkSettleError::MalformedProof);
    }
    Ok(data.split_at(data.len() - witness_len))
}

/// Enforce that the witness publicly commits to the issuer's merkle root and to
/// the instruction's nullifier hash. Compiled unconditionally so unit tests run
/// under the default feature set; the call site in `handler` stays cfg-gated.
#[cfg_attr(feature = "placeholder-vk", allow(dead_code))]
pub(crate) fn check_bindings<const N: usize>(
    witness: &GnarkWitness<N>,
    merkle_root: &[u8; 32],
    nullifier_hash: &[u8; 32],
) -> Result<()> {
    require!(N > NULLIFIER_IDX, ZkSettleError::WitnessTooShort);
    require!(
        &witness.entries[MERKLE_ROOT_IDX] == merkle_root,
        ZkSettleError::MerkleRootMismatch
    );
    require!(
        &witness.entries[NULLIFIER_IDX] == nullifier_hash,
        ZkSettleError::NullifierMismatch
    );
    Ok(())
}

#[derive(Accounts)]
#[instruction(proof_and_witness: Vec<u8>, nullifier_hash: [u8; 32])]
pub struct VerifyProof<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, issuer.authority.as_ref()],
        bump = issuer.bump,
    )]
    pub issuer: Account<'info, Issuer>,

    #[account(
        init,
        payer = payer,
        space = 8 + Nullifier::LEN,
        seeds = [NULLIFIER_SEED, issuer.key().as_ref(), nullifier_hash.as_ref()],
        bump,
    )]
    pub nullifier: Account<'info, Nullifier>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<VerifyProof>,
    proof_and_witness: Vec<u8>,
    nullifier_hash: [u8; 32],
) -> Result<()> {
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

    #[cfg(not(feature = "placeholder-vk"))]
    check_bindings(
        &witness,
        &ctx.accounts.issuer.merkle_root,
        &nullifier_hash,
    )?;

    let mut verifier: GnarkVerifier<NR_INPUTS> = GnarkVerifier::new(&VK);

    verifier.verify(proof, witness).map_err(|e| {
        msg!("Proof verification failed: {:?}", e);
        error!(ZkSettleError::ProofInvalid)
    })?;

    #[cfg(feature = "placeholder-vk")]
    let _ = &ctx;

    msg!("Proof settled: nullifier={:?}", nullifier_hash);
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

    mod bindings {
        use super::*;

        fn witness_with(root: [u8; 32], nullifier: [u8; 32]) -> GnarkWitness<2> {
            let mut entries = [[0u8; 32]; 2];
            entries[MERKLE_ROOT_IDX] = root;
            entries[NULLIFIER_IDX] = nullifier;
            GnarkWitness { entries }
        }

        #[test]
        fn binding_check_accepts_matching_root_and_nullifier() {
            let root = [1u8; 32];
            let nul = [2u8; 32];
            let w = witness_with(root, nul);
            assert!(check_bindings(&w, &root, &nul).is_ok());
        }

        #[test]
        fn binding_check_rejects_root_mismatch() {
            let w = witness_with([1u8; 32], [2u8; 32]);
            assert_eq!(
                err_code(check_bindings(&w, &[9u8; 32], &[2u8; 32])),
                ERROR_CODE_OFFSET + ZkSettleError::MerkleRootMismatch as u32,
            );
        }

        #[test]
        fn binding_check_rejects_nullifier_mismatch() {
            let w = witness_with([1u8; 32], [2u8; 32]);
            assert_eq!(
                err_code(check_bindings(&w, &[1u8; 32], &[9u8; 32])),
                ERROR_CODE_OFFSET + ZkSettleError::NullifierMismatch as u32,
            );
        }
    }
}
