pub mod error;
pub mod instructions;

#[allow(dead_code, clippy::all)]
mod generated_vk;

use anchor_lang::prelude::*;

pub use instructions::*;

declare_id!("AyZk4CYFAFFJiFC2WqqXY2oq2pgN6vvrWwYbbWz7z7Jo");

#[program]
pub mod zksettle {
    use super::*;

    pub fn verify_proof(ctx: Context<VerifyProof>, proof_and_witness: Vec<u8>) -> Result<()> {
        instructions::verify_proof::handler(ctx, proof_and_witness)
    }
}
