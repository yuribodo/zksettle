pub mod error;
pub mod instructions;
pub mod state;

#[allow(dead_code, clippy::all)]
mod generated_vk;

use anchor_lang::prelude::*;

pub use instructions::*;

declare_id!("AyZk4CYFAFFJiFC2WqqXY2oq2pgN6vvrWwYbbWz7z7Jo");

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

    pub fn verify_proof(
        ctx: Context<VerifyProof>,
        proof_and_witness: Vec<u8>,
        nullifier_hash: [u8; 32],
    ) -> Result<()> {
        instructions::verify_proof::handler(ctx, proof_and_witness, nullifier_hash)
    }
}
