use anchor_lang::prelude::*;
use light_sdk::{
    account::LightAccount,
    address::v2::derive_address,
    cpi::{
        v2::{CpiAccounts, LightSystemProgramCpi},
        InvokeLightSystemProgram, LightCpiInstruction,
    },
    instruction::{PackedAddressTreeInfo, PackedAddressTreeInfoExt, ValidityProof},
};

use crate::error::ZkSettleError;
use crate::state::{
    compressed::{CompressedAttestation, CompressedNullifier},
    ATTESTATION_SEED, NULLIFIER_SEED,
};

use super::bindings::{verify_bundle, BindingInputs};
use super::helpers::validate_epoch;
use super::VerifyProof;

#[event]
pub struct ProofSettled {
    pub issuer: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub epoch: u64,
    pub slot: u64,
    pub payer: Pubkey,
}

#[allow(clippy::too_many_arguments)]
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, VerifyProof<'info>>,
    proof_and_witness: Vec<u8>,
    nullifier_hash: [u8; 32],
    mint: Pubkey,
    epoch: u64,
    recipient: Pubkey,
    amount: u64,
    validity_proof: ValidityProof,
    address_tree_info: PackedAddressTreeInfo,
    output_state_tree_index: u8,
) -> Result<()> {
    require!(nullifier_hash != [0u8; 32], ZkSettleError::ZeroNullifier);

    let clock = Clock::get()?;
    validate_epoch(clock.unix_timestamp, epoch)?;

    verify_bundle(
        &proof_and_witness,
        &BindingInputs {
            merkle_root: &ctx.accounts.issuer.merkle_root,
            nullifier_hash: &nullifier_hash,
            mint: &mint,
            epoch,
            recipient: &recipient,
            amount,
        },
    )?;

    let issuer_key = ctx.accounts.issuer.key();
    let merkle_root = ctx.accounts.issuer.merkle_root;
    let payer_key = ctx.accounts.payer.key();
    let slot = clock.slot;
    let issuer_bytes = issuer_key.to_bytes();

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.payer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    let address_tree_pubkey = address_tree_info
        .get_tree_pubkey(&light_cpi_accounts)
        .map_err(crate::map_light_err!(
            "get_tree_pubkey failed",
            ZkSettleError::InvalidLightAddress
        ))?;

    let (null_addr, null_seed) = derive_address(
        &[NULLIFIER_SEED, &issuer_bytes, &nullifier_hash],
        &address_tree_pubkey,
        &crate::ID,
    );
    let (att_addr, att_seed) = derive_address(
        &[ATTESTATION_SEED, &issuer_bytes, &nullifier_hash],
        &address_tree_pubkey,
        &crate::ID,
    );

    let null_params =
        address_tree_info.into_new_address_params_assigned_packed(null_seed, Some(0));
    let att_params = address_tree_info.into_new_address_params_assigned_packed(att_seed, Some(1));

    let nullifier_account = LightAccount::<CompressedNullifier>::new_init(
        &crate::ID,
        Some(null_addr),
        output_state_tree_index,
    );

    let mut attestation_account = LightAccount::<CompressedAttestation>::new_init(
        &crate::ID,
        Some(att_addr),
        output_state_tree_index,
    );
    attestation_account.issuer = issuer_bytes;
    attestation_account.nullifier_hash = nullifier_hash;
    attestation_account.merkle_root = merkle_root;
    attestation_account.mint = mint.to_bytes();
    attestation_account.recipient = recipient.to_bytes();
    attestation_account.amount = amount;
    attestation_account.epoch = epoch;
    attestation_account.slot = slot;
    attestation_account.payer = payer_key.to_bytes();

    LightSystemProgramCpi::new_cpi(crate::LIGHT_CPI_SIGNER, validity_proof)
        .with_new_addresses(&[null_params, att_params])
        .with_light_account(nullifier_account)
        .map_err(crate::map_light_err!(
            "with_light_account nullifier",
            ZkSettleError::LightAccountPackFailed
        ))?
        .with_light_account(attestation_account)
        .map_err(crate::map_light_err!(
            "with_light_account attestation",
            ZkSettleError::LightAccountPackFailed
        ))?
        .invoke(light_cpi_accounts)
        .map_err(crate::map_light_err!(
            "Light CPI invoke failed",
            ZkSettleError::LightInvokeFailed
        ))?;

    emit!(ProofSettled {
        issuer: issuer_key,
        nullifier_hash,
        merkle_root,
        mint,
        recipient,
        amount,
        epoch,
        slot,
        payer: payer_key,
    });

    Ok(())
}
