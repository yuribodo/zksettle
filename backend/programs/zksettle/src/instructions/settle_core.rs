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

use super::verify_proof::ProofSettled;

pub(crate) struct SettlementParams<'a, 'info> {
    pub issuer_key: Pubkey,
    pub issuer_bytes: [u8; 32],
    pub nullifier_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub sanctions_root: [u8; 32],
    pub jurisdiction_root: [u8; 32],
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub epoch: u64,
    pub timestamp: u64,
    pub slot: u64,
    pub payer_key: Pubkey,
    pub validity_proof: ValidityProof,
    pub address_tree_info: PackedAddressTreeInfo,
    pub output_state_tree_index: u8,
    pub payer_info: &'a AccountInfo<'info>,
    pub remaining_accounts: &'a [AccountInfo<'info>],
}

pub(crate) fn settle_core(params: SettlementParams<'_, '_>) -> Result<()> {
    let light_cpi_accounts = CpiAccounts::new(
        params.payer_info,
        params.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    let address_tree_pubkey = params
        .address_tree_info
        .get_tree_pubkey(&light_cpi_accounts)
        .map_err(crate::map_light_err!(
            "get_tree_pubkey failed",
            ZkSettleError::InvalidLightAddress
        ))?;

    let (null_addr, null_seed) = derive_address(
        &[NULLIFIER_SEED, &params.issuer_bytes, &params.nullifier_hash],
        &address_tree_pubkey,
        &crate::ID,
    );
    let (att_addr, att_seed) = derive_address(
        &[
            ATTESTATION_SEED,
            &params.issuer_bytes,
            &params.nullifier_hash,
        ],
        &address_tree_pubkey,
        &crate::ID,
    );

    let null_params = params
        .address_tree_info
        .into_new_address_params_assigned_packed(null_seed, Some(0));
    let att_params = params
        .address_tree_info
        .into_new_address_params_assigned_packed(att_seed, Some(1));

    let nullifier_account = LightAccount::<CompressedNullifier>::new_init(
        &crate::ID,
        Some(null_addr),
        params.output_state_tree_index,
    );

    let mut attestation_account = LightAccount::<CompressedAttestation>::new_init(
        &crate::ID,
        Some(att_addr),
        params.output_state_tree_index,
    );
    attestation_account.issuer = params.issuer_bytes;
    attestation_account.nullifier_hash = params.nullifier_hash;
    attestation_account.merkle_root = params.merkle_root;
    attestation_account.sanctions_root = params.sanctions_root;
    attestation_account.jurisdiction_root = params.jurisdiction_root;
    attestation_account.mint = params.mint.to_bytes();
    attestation_account.recipient = params.recipient.to_bytes();
    attestation_account.amount = params.amount;
    attestation_account.epoch = params.epoch;
    attestation_account.timestamp = params.timestamp;
    attestation_account.slot = params.slot;
    attestation_account.payer = params.payer_key.to_bytes();

    LightSystemProgramCpi::new_cpi(crate::LIGHT_CPI_SIGNER, params.validity_proof)
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
        version: 1,
        issuer: params.issuer_key,
        nullifier_hash: params.nullifier_hash,
        merkle_root: params.merkle_root,
        sanctions_root: params.sanctions_root,
        jurisdiction_root: params.jurisdiction_root,
        mint: params.mint,
        recipient: params.recipient,
        amount: params.amount,
        epoch: params.epoch,
        timestamp: params.timestamp,
        slot: params.slot,
        payer: params.payer_key,
    });

    Ok(())
}
