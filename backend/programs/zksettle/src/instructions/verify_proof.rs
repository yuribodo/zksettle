use anchor_lang::prelude::*;
use gnark_verifier_solana::{proof::GnarkProof, verifier::GnarkVerifier, witness::GnarkWitness};

use crate::error::ZkSettleError;
use crate::generated_vk::VK;

#[derive(Accounts)]
pub struct VerifyProof {}

pub fn handler(_ctx: Context<VerifyProof>, proof_and_witness: Vec<u8>) -> Result<()> {
    const NR_INPUTS: usize = VK.nr_pubinputs;
    const N_COMMITMENTS: usize = VK.commitment_keys.len();

    let witness_len = 12 + NR_INPUTS * 32;
    if proof_and_witness.len() <= witness_len {
        return err!(ZkSettleError::MalformedProof);
    }
    let proof_len = proof_and_witness.len() - witness_len;
    let (proof_bytes, witness_bytes) = proof_and_witness.split_at(proof_len);

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
