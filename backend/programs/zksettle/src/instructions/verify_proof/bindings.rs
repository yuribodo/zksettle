use anchor_lang::prelude::*;
use gnark_verifier_solana::{proof::GnarkProof, verifier::GnarkVerifier, witness::GnarkWitness};

use crate::error::ZkSettleError;
use crate::generated_vk::VK;
use crate::state::{
    AMOUNT_IDX, EPOCH_IDX, JURISDICTION_ROOT_IDX, MERKLE_ROOT_IDX, MINT_HI_IDX, MINT_LO_IDX,
    NULLIFIER_IDX, RECIPIENT_HI_IDX, RECIPIENT_LO_IDX, SANCTIONS_ROOT_IDX, TIMESTAMP_IDX,
};

use super::helpers::{expected_witness_len, pubkey_to_limbs, split_proof_and_witness, u64_to_field_bytes};

// Current VK has 8 public inputs. Circuit declares 11 (indices 0–10 in
// pubinputs.rs). Bump to 11 when regenerating VK from the 11-input circuit.
#[cfg(not(feature = "placeholder-vk"))]
const _: () = assert!(
    VK.nr_pubinputs == 8,
    "VK must expose exactly 8 public inputs (must match generated_vk.rs / default.vk)",
);

#[cfg_attr(feature = "placeholder-vk", allow(dead_code))]
pub(crate) struct BindingInputs<'a> {
    pub merkle_root: &'a [u8; 32],
    pub nullifier_hash: &'a [u8; 32],
    pub mint: &'a Pubkey,
    pub epoch: u64,
    pub recipient: &'a Pubkey,
    pub amount: u64,
    // TODO: add check_bindings entries when VK expands beyond 8 public inputs.
    #[allow(dead_code)]
    pub sanctions_root: &'a [u8; 32],
    #[allow(dead_code)]
    pub jurisdiction_root: &'a [u8; 32],
    #[allow(dead_code)]
    pub timestamp: u64,
}

#[cfg_attr(feature = "placeholder-vk", allow(dead_code))]
pub(crate) fn check_bindings<const N: usize>(
    witness: &GnarkWitness<N>,
    inputs: &BindingInputs<'_>,
) -> Result<()> {
    require!(N > AMOUNT_IDX, ZkSettleError::WitnessTooShort);
    require!(
        &witness.entries[MERKLE_ROOT_IDX] == inputs.merkle_root,
        ZkSettleError::MerkleRootMismatch
    );
    require!(
        &witness.entries[NULLIFIER_IDX] == inputs.nullifier_hash,
        ZkSettleError::NullifierMismatch
    );

    let (mint_lo, mint_hi) = pubkey_to_limbs(inputs.mint);
    require!(
        witness.entries[MINT_LO_IDX] == mint_lo && witness.entries[MINT_HI_IDX] == mint_hi,
        ZkSettleError::MintMismatch
    );

    require!(
        witness.entries[EPOCH_IDX] == u64_to_field_bytes(inputs.epoch),
        ZkSettleError::EpochMismatch
    );

    let (rcpt_lo, rcpt_hi) = pubkey_to_limbs(inputs.recipient);
    require!(
        witness.entries[RECIPIENT_LO_IDX] == rcpt_lo && witness.entries[RECIPIENT_HI_IDX] == rcpt_hi,
        ZkSettleError::RecipientMismatch
    );

    require!(
        witness.entries[AMOUNT_IDX] == u64_to_field_bytes(inputs.amount),
        ZkSettleError::AmountMismatch
    );

    // Activate when VK is regenerated with 11 public inputs.
    if N > TIMESTAMP_IDX {
        require!(
            &witness.entries[SANCTIONS_ROOT_IDX] == inputs.sanctions_root,
            ZkSettleError::SanctionsRootMismatch
        );
        require!(
            &witness.entries[JURISDICTION_ROOT_IDX] == inputs.jurisdiction_root,
            ZkSettleError::JurisdictionRootMismatch
        );
        require!(
            witness.entries[TIMESTAMP_IDX] == u64_to_field_bytes(inputs.timestamp),
            ZkSettleError::TimestampMismatch
        );
    }

    Ok(())
}

/// Parse `proof_and_witness`, rebind public inputs to `BindingInputs`, and run
/// the Groth16 pairing check. Returns `Ok(())` only if every binding matches
/// and the proof verifies. Shared by `verify_proof` handler and the Token-2022
/// transfer hook.
#[cfg_attr(feature = "placeholder-vk", allow(unused_variables))]
pub(crate) fn verify_bundle(proof_and_witness: &[u8], bindings: &BindingInputs<'_>) -> Result<()> {
    const NR_INPUTS: usize = VK.nr_pubinputs;
    const N_COMMITMENTS: usize = VK.commitment_keys.len();

    let witness_len = expected_witness_len(NR_INPUTS);
    let (proof_bytes, witness_bytes) = split_proof_and_witness(proof_and_witness, witness_len)?;

    let proof = GnarkProof::<N_COMMITMENTS>::from_bytes(proof_bytes)
        .map_err(crate::map_light_err!("Gnark proof parse error", ZkSettleError::MalformedProof))?;

    let witness = GnarkWitness::from_bytes(witness_bytes)
        .map_err(crate::map_light_err!("Gnark witness parse error", ZkSettleError::MalformedProof))?;

    #[cfg(not(feature = "placeholder-vk"))]
    check_bindings(&witness, bindings)?;

    let mut verifier: GnarkVerifier<NR_INPUTS> = GnarkVerifier::new(&VK);
    verifier
        .verify(proof, witness)
        .map_err(crate::map_light_err!("Proof verification failed", ZkSettleError::ProofInvalid))?;

    Ok(())
}
