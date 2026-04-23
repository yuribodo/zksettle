//! Bubblegum `MintV1` / `CreateTreeConfig` CPIs (ADR-019). Raw `invoke_signed` layout matches
//! Metaplex mpl-bubblegum kinobi output — avoids pulling `mpl-bubblegum` (Solana SDK 3.x) into
//! this Anchor 0.31 / Solana 2.x program.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};

use crate::constants::{BUBBLEGUM_MINT_V1_ACCOUNT_COUNT, MAX_ROOT_AGE_SLOTS};
use crate::error::ZkSettleError;
use crate::state::BUBBLEGUM_TREE_CREATOR_SEED;
use spl_account_compression::ID as SPL_ACCOUNT_COMPRESSION_ID;

/// Metaplex Bubblegum program id (mainnet / devnet).
pub const MPL_BUBBLEGUM_ID: Pubkey = pubkey!("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");

pub const NOOP_PROGRAM_ID: Pubkey = pubkey!("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");

pub fn tree_config_pda(merkle_tree: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[merkle_tree.as_ref()], &MPL_BUBBLEGUM_ID)
}

const CREATE_TREE_CONFIG_DISC: [u8; 8] = [165, 83, 136, 142, 89, 202, 47, 220];
const MINT_V1_DISC: [u8; 8] = [145, 98, 192, 118, 184, 147, 118, 104];

#[derive(AnchorSerialize)]
struct CreateTreeConfigDisc {
    discriminator: [u8; 8],
}

impl CreateTreeConfigDisc {
    fn new() -> Self {
        Self {
            discriminator: CREATE_TREE_CONFIG_DISC,
        }
    }
}

#[derive(AnchorSerialize)]
struct CreateTreeConfigArgs {
    max_depth: u32,
    max_buffer_size: u32,
    public: Option<bool>,
}

#[derive(AnchorSerialize, Clone, Debug, PartialEq, Eq)]
pub enum BgTokenStandard {
    NonFungible,
    FungibleAsset,
    Fungible,
    NonFungibleEdition,
}

#[derive(AnchorSerialize, Clone, Debug, PartialEq, Eq)]
pub enum BgTokenProgramVersion {
    Original,
    Token2022,
}

#[derive(AnchorSerialize, Clone, Debug, PartialEq, Eq)]
pub struct BgCreator {
    pub address: Pubkey,
    pub verified: bool,
    pub share: u8,
}

/// Wire-compatible with mpl-bubblegum `MetadataArgs` (kinobi / AnchorSerialize).
#[derive(AnchorSerialize, Clone, Debug)]
pub struct BgMetadataArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub seller_fee_basis_points: u16,
    pub primary_sale_happened: bool,
    pub is_mutable: bool,
    pub edition_nonce: Option<u8>,
    pub token_standard: Option<BgTokenStandard>,
    pub collection: Option<()>,
    pub uses: Option<()>,
    pub token_program_version: BgTokenProgramVersion,
    pub creators: Vec<BgCreator>,
}

#[derive(AnchorSerialize)]
struct MintV1Disc {
    discriminator: [u8; 8],
}

impl MintV1Disc {
    fn new() -> Self {
        Self {
            discriminator: MINT_V1_DISC,
        }
    }
}

#[derive(AnchorSerialize)]
struct MintV1Args {
    metadata: BgMetadataArgs,
}

pub fn bubblegum_merkle_tree_body_space() -> usize {
    use std::mem::size_of;
    use spl_account_compression::ConcurrentMerkleTree;
    size_of::<ConcurrentMerkleTree<14, 64>>()
}

pub fn bubblegum_merkle_tree_account_size() -> usize {
    spl_account_compression::state::CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1 + bubblegum_merkle_tree_body_space()
}

pub fn attestation_metadata_uri(
    issuer: &Pubkey,
    nullifier_hash: &[u8; 32],
    merkle_root: &[u8; 32],
    slot: u64,
    expiry_slot: u64,
) -> String {
    let h = anchor_lang::solana_program::hash::hashv(&[
        issuer.as_ref(),
        nullifier_hash.as_ref(),
        merkle_root.as_ref(),
        &slot.to_le_bytes(),
        &expiry_slot.to_le_bytes(),
    ]);
    // TODO: move base URI to registry (follow-up)
    format!(
        "https://zksettle.dev/meta/v1/{}",
        h.to_string().chars().take(44).collect::<String>()
    )
}

pub fn attestation_metadata_name(slot: u64) -> String {
    format!("ZKS-{slot}")
}

pub fn build_attestation_metadata(
    issuer: Pubkey,
    slot: u64,
    nullifier_hash: &[u8; 32],
    merkle_root: &[u8; 32],
) -> BgMetadataArgs {
    let expiry_slot = slot.saturating_add(MAX_ROOT_AGE_SLOTS);
    BgMetadataArgs {
        name: attestation_metadata_name(slot),
        symbol: "ZKSATT".to_string(),
        uri: attestation_metadata_uri(&issuer, nullifier_hash, merkle_root, slot, expiry_slot),
        seller_fee_basis_points: 0,
        primary_sale_happened: false,
        is_mutable: true,
        edition_nonce: None,
        token_standard: Some(BgTokenStandard::NonFungible),
        collection: None,
        uses: None,
        token_program_version: BgTokenProgramVersion::Original,
        creators: vec![BgCreator {
            address: issuer,
            verified: false,
            share: 100,
        }],
    }
}

pub fn invoke_create_tree_config<'info>(
    bubblegum_program: &AccountInfo<'info>,
    tree_config: &AccountInfo<'info>,
    merkle_tree: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    tree_creator: &AccountInfo<'info>,
    log_wrapper: &AccountInfo<'info>,
    compression_program: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    max_depth: u32,
    max_buffer_size: u32,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = CreateTreeConfigDisc::new()
        .try_to_vec()
        .map_err(|_| error!(ZkSettleError::BubblegumCpiFailed))?;
    let args = CreateTreeConfigArgs {
        max_depth,
        max_buffer_size,
        public: Some(false),
    };
    data.extend_from_slice(
        &args
            .try_to_vec()
            .map_err(|_| error!(ZkSettleError::BubblegumCpiFailed))?,
    );

    let ix = Instruction {
        program_id: MPL_BUBBLEGUM_ID,
        accounts: vec![
            AccountMeta::new(tree_config.key(), false),
            AccountMeta::new(merkle_tree.key(), false),
            AccountMeta::new(payer.key(), true),
            AccountMeta::new_readonly(tree_creator.key(), true),
            AccountMeta::new_readonly(log_wrapper.key(), false),
            AccountMeta::new_readonly(compression_program.key(), false),
            AccountMeta::new_readonly(system_program.key(), false),
        ],
        data,
    };

    invoke_signed(
        &ix,
        &[
            bubblegum_program.clone(),
            tree_config.clone(),
            merkle_tree.clone(),
            payer.clone(),
            tree_creator.clone(),
            log_wrapper.clone(),
            compression_program.clone(),
            system_program.clone(),
        ],
        signer_seeds,
    )
    .map_err(|_| error!(ZkSettleError::BubblegumCpiFailed))?;
    Ok(())
}

pub fn invoke_mint_v1<'info>(
    bubblegum_program: &AccountInfo<'info>,
    tree_config: &AccountInfo<'info>,
    leaf_owner: &AccountInfo<'info>,
    merkle_tree: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    tree_creator_or_delegate: &AccountInfo<'info>,
    log_wrapper: &AccountInfo<'info>,
    compression_program: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    metadata: BgMetadataArgs,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = MintV1Disc::new()
        .try_to_vec()
        .map_err(|_| error!(ZkSettleError::BubblegumCpiFailed))?;
    let args = MintV1Args { metadata };
    data.extend_from_slice(
        &args
            .try_to_vec()
            .map_err(|_| error!(ZkSettleError::BubblegumCpiFailed))?,
    );

    let ix = Instruction {
        program_id: MPL_BUBBLEGUM_ID,
        accounts: vec![
            AccountMeta::new(tree_config.key(), false),
            AccountMeta::new_readonly(leaf_owner.key(), false),
            AccountMeta::new_readonly(leaf_owner.key(), false),
            AccountMeta::new(merkle_tree.key(), false),
            AccountMeta::new_readonly(payer.key(), true),
            AccountMeta::new_readonly(tree_creator_or_delegate.key(), true),
            AccountMeta::new_readonly(log_wrapper.key(), false),
            AccountMeta::new_readonly(compression_program.key(), false),
            AccountMeta::new_readonly(system_program.key(), false),
        ],
        data,
    };

    invoke_signed(
        &ix,
        &[
            bubblegum_program.clone(),
            tree_config.clone(),
            leaf_owner.clone(),
            leaf_owner.clone(),
            merkle_tree.clone(),
            payer.clone(),
            tree_creator_or_delegate.clone(),
            log_wrapper.clone(),
            compression_program.clone(),
            system_program.clone(),
        ],
        signer_seeds,
    )
    .map_err(|_| error!(ZkSettleError::BubblegumCpiFailed))?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn cpi_mint_compliance_attestation<'info>(
    bubblegum_program: &AccountInfo<'info>,
    tree_config: &AccountInfo<'info>,
    merkle_tree: &AccountInfo<'info>,
    tree_creator: &AccountInfo<'info>,
    tree_creator_bump: u8,
    compression_program: &AccountInfo<'info>,
    log_wrapper: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    leaf_owner: &AccountInfo<'info>,
    issuer: Pubkey,
    nullifier_hash: [u8; 32],
    merkle_root: [u8; 32],
    slot: u64,
) -> Result<()> {
    require_keys_eq!(
        *merkle_tree.owner,
        SPL_ACCOUNT_COMPRESSION_ID,
        ZkSettleError::BubblegumCpiFailed
    );

    let metadata = build_attestation_metadata(issuer, slot, &nullifier_hash, &merkle_root);

    let seeds: &[&[u8]] = &[BUBBLEGUM_TREE_CREATOR_SEED, &[tree_creator_bump]];
    invoke_mint_v1(
        bubblegum_program,
        tree_config,
        leaf_owner,
        merkle_tree,
        payer,
        tree_creator,
        log_wrapper,
        compression_program,
        system_program,
        metadata,
        &[seeds],
    )
}

pub fn split_light_and_bubblegum<'c, 'info>(
    remaining: &'c [AccountInfo<'info>],
    bubblegum_tail: u8,
) -> Result<(
    &'c [AccountInfo<'info>],
    &'c [AccountInfo<'info>],
)> {
    let n = bubblegum_tail as usize;
    require!(
        n == 0 || n == BUBBLEGUM_MINT_V1_ACCOUNT_COUNT,
        ZkSettleError::BubblegumTailInvalid
    );
    if n == 0 {
        return Ok((remaining, &[]));
    }
    require!(
        remaining.len() >= n,
        ZkSettleError::BubblegumTailInvalid
    );
    let split = remaining.len() - n;
    Ok((&remaining[..split], &remaining[split..]))
}

pub fn cpi_mint_from_remaining_tail<'info>(
    bubblegum_program: &AccountInfo<'info>,
    tail: &[AccountInfo<'info>],
    tree_creator_bump: u8,
    registry_merkle_tree: &Pubkey,
    expected_leaf_owner: &Pubkey,
    issuer: Pubkey,
    nullifier_hash: [u8; 32],
    merkle_root: [u8; 32],
    slot: u64,
) -> Result<()> {
    require!(
        tail.len() == BUBBLEGUM_MINT_V1_ACCOUNT_COUNT,
        ZkSettleError::BubblegumTailInvalid
    );

    // tail layout: [0] tree_config, [1] leaf_owner, [2] merkle_tree, [3] payer,
    // [4] tree_creator, [5] log_wrapper, [6] compression, [7] system_program

    require_keys_eq!(
        tail[2].key(),
        *registry_merkle_tree,
        ZkSettleError::BubblegumTreeMismatch
    );
    require_keys_eq!(
        *tail[2].owner,
        SPL_ACCOUNT_COMPRESSION_ID,
        ZkSettleError::BubblegumCpiFailed
    );
    let (expected_cfg, _) = tree_config_pda(registry_merkle_tree);
    require_keys_eq!(
        tail[0].key(),
        expected_cfg,
        ZkSettleError::BubblegumCpiFailed
    );
    require_keys_eq!(
        tail[1].key(),
        *expected_leaf_owner,
        ZkSettleError::BubblegumLeafOwnerMismatch
    );

    let seeds: &[&[u8]] = &[BUBBLEGUM_TREE_CREATOR_SEED, &[tree_creator_bump]];
    let metadata = build_attestation_metadata(issuer, slot, &nullifier_hash, &merkle_root);

    invoke_mint_v1(
        bubblegum_program,
        &tail[0],
        &tail[1],
        &tail[2],
        &tail[3],
        &tail[4],
        &tail[5],
        &tail[6],
        &tail[7],
        metadata,
        &[seeds],
    )
}
