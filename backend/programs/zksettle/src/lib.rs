pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

#[allow(dead_code, clippy::all)]
mod generated_vk;

use anchor_lang::prelude::*;
use light_sdk::cpi::CpiSigner;
use light_sdk::derive_light_cpi_signer;

pub use instructions::*;

declare_id!("AyZk4CYFAFFJiFC2WqqXY2oq2pgN6vvrWwYbbWz7z7Jo");

/// Light Protocol CPI signer derived from the program ID.
///
/// INVARIANT: the literal below MUST match the one passed to `declare_id!`
/// above. Both `declare_id!` and `derive_light_cpi_signer!` are proc macros
/// that require a string literal, so the value cannot be extracted into a
/// shared `const`. Update both sites together.
pub const LIGHT_CPI_SIGNER: CpiSigner =
    derive_light_cpi_signer!("AyZk4CYFAFFJiFC2WqqXY2oq2pgN6vvrWwYbbWz7z7Jo");

#[program]
pub mod zksettle {
    use super::*;

    pub fn register_issuer(ctx: Context<RegisterIssuer>, merkle_root: [u8; 32]) -> Result<()> {
        instructions::register_issuer::register_handler(ctx, merkle_root)
    }

    pub fn update_issuer_root(
        ctx: Context<UpdateIssuerRoot>,
        merkle_root: [u8; 32],
    ) -> Result<()> {
        instructions::register_issuer::update_handler(ctx, merkle_root)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn verify_proof<'info>(
        ctx: Context<'_, '_, '_, 'info, VerifyProof<'info>>,
        proof_and_witness: Vec<u8>,
        nullifier_hash: [u8; 32],
        mint: Pubkey,
        epoch: u64,
        recipient: Pubkey,
        amount: u64,
        validity_proof: light_sdk::instruction::ValidityProof,
        address_tree_info: light_sdk::instruction::PackedAddressTreeInfo,
        output_state_tree_index: u8,
    ) -> Result<()> {
        instructions::verify_proof::handler(
            ctx,
            proof_and_witness,
            nullifier_hash,
            mint,
            epoch,
            recipient,
            amount,
            validity_proof,
            address_tree_info,
            output_state_tree_index,
        )
    }

    pub fn check_attestation<'info>(
        ctx: Context<'_, '_, '_, 'info, CheckAttestation<'info>>,
        nullifier_hash: [u8; 32],
        validity_proof: light_sdk::instruction::ValidityProof,
        attestation_meta: light_sdk::instruction::account_meta::CompressedAccountMetaReadOnly,
        compressed_attestation: crate::state::compressed::CompressedAttestation,
    ) -> Result<()> {
        instructions::check_attestation::check_handler(
            ctx,
            nullifier_hash,
            validity_proof,
            attestation_meta,
            compressed_attestation,
        )
    }
}
