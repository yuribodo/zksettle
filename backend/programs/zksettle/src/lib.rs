pub mod constants;
mod cu_probe;
pub mod error;
pub mod instructions;
pub mod state;
#[cfg(test)]
mod test_utils;

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

    pub fn init_attestation_tree(ctx: Context<InitAttestationTree>) -> Result<()> {
        crate::instructions::init_attestation_tree::init_handler(ctx)
    }

    pub fn register_issuer(
        ctx: Context<RegisterIssuer>,
        merkle_root: [u8; 32],
        sanctions_root: [u8; 32],
        jurisdiction_root: [u8; 32],
    ) -> Result<()> {
        instructions::register_issuer::register_handler(ctx, merkle_root, sanctions_root, jurisdiction_root)
    }

    pub fn update_issuer_root(
        ctx: Context<UpdateIssuerRoot>,
        merkle_root: [u8; 32],
        sanctions_root: [u8; 32],
        jurisdiction_root: [u8; 32],
    ) -> Result<()> {
        instructions::register_issuer::update_handler(ctx, merkle_root, sanctions_root, jurisdiction_root)
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

    #[allow(clippy::too_many_arguments)]
    pub fn set_hook_payload(
        ctx: Context<SetHookPayload>,
        proof_and_witness: Vec<u8>,
        nullifier_hash: [u8; 32],
        mint: Pubkey,
        epoch: u64,
        recipient: Pubkey,
        amount: u64,
        light_args: instructions::transfer_hook::StagedLightArgs,
    ) -> Result<()> {
        instructions::transfer_hook::set_hook_payload_handler(
            ctx,
            proof_and_witness,
            nullifier_hash,
            mint,
            epoch,
            recipient,
            amount,
            light_args,
        )
    }

    pub fn init_extra_account_meta_list(
        ctx: Context<InitExtraAccountMetaList>,
        extras: Vec<instructions::transfer_hook::ExtraAccountMetaInput>,
    ) -> Result<()> {
        instructions::transfer_hook::init_extra_account_meta_list_handler(ctx, extras)
    }

    /// Direct-call settlement. Issuer authority signs and receives rent refund
    /// from the closed payload. Not invoked by Token-2022.
    pub fn settle_hook<'info>(
        ctx: Context<'_, '_, '_, 'info, SettleHook<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::transfer_hook::settle_hook_handler(ctx, amount)
    }

    pub fn close_hook_payload(ctx: Context<CloseHookPayload>) -> Result<()> {
        instructions::transfer_hook::close_hook_payload_handler(ctx)
    }

    /// Token-2022 transfer-hook `Execute` entry. Discriminator matches
    /// `sha256("spl-transfer-hook-interface:execute")[..8]` — value taken from
    /// `spl_transfer_hook_interface::instruction::ExecuteInstruction::SPL_DISCRIMINATOR`.
    ///
    /// Replay barrier: Light compressed-address collision on
    /// `[NULLIFIER_SEED, issuer, nullifier_hash]` (ADR-007 + ADR-020). The
    /// payload PDA is NOT closed here — SPL passes `owner` as read-only
    /// (`AccountMeta::new_readonly`), blocking `close = owner`. Authority
    /// calls `close_hook_payload` after the transfer to reclaim rent and
    /// unblock the next `set_hook_payload`.
    #[instruction(discriminator = &[105, 37, 101, 197, 75, 251, 102, 26])]
    pub fn transfer_hook<'info>(
        ctx: Context<'_, '_, '_, 'info, ExecuteHook<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::transfer_hook::execute_hook_handler(ctx, amount)
    }
}
