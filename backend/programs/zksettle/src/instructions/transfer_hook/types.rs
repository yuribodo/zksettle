use anchor_lang::prelude::*;
use light_sdk::instruction::{CompressedProof, PackedAddressTreeInfo, ValidityProof};
use spl_tlv_account_resolution::account::ExtraAccountMeta;

use crate::error::ZkSettleError;

pub const HOOK_PAYLOAD_SEED: &[u8] = b"hook-payload";
/// Matches `spl_transfer_hook_interface::EXTRA_ACCOUNT_METAS_SEED`.
pub const EXTRA_ACCOUNT_META_LIST_SEED: &[u8] = b"extra-account-metas";

/// Upper bound on `proof_and_witness` bytes held in the payload PDA.
///
/// Sized against the compliance VK (8 public inputs, 3 commitments). Real
/// payloads are < 2 KB; 16 KB is a coarse safety ceiling that still fits the
/// `init` rent envelope. Lower before mainnet if the circuit shape freezes.
pub const MAX_HOOK_PROOF_BYTES: usize = 16_384;

/// Pre-staged Light CPI arguments stored in the hook payload so the Token-2022
/// Execute entry — which only receives `amount: u64` as instruction data — can
/// still drive a Light CPI. Clients must include `set_hook_payload` and the
/// Token-2022 transfer in a single atomic transaction (same-tx staging),
/// otherwise the tree-root index and validity proof go stale.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace)]
pub struct StagedLightArgs {
    /// Trailing accounts on Token-2022 `Execute` (after Light metas) for Bubblegum `MintV1`
    /// (`BUBBLEGUM_MINT_V1_ACCOUNT_COUNT`) or `0` when not minting in the hook path.
    pub bubblegum_tail: u8,
    /// Whether a compressed proof is present; mirrors `ValidityProof(Option<_>)`.
    pub proof_present: bool,
    /// Packed Groth16 proof bytes, only meaningful when `proof_present` is true.
    pub proof_bytes: [u8; 128],
    /// Index into remaining_accounts of the address merkle tree.
    pub address_mt_index: u8,
    /// Index into remaining_accounts of the address queue.
    pub address_queue_index: u8,
    /// Address-tree root index (for replayability vs. live root).
    pub address_root_index: u16,
    /// Output state-tree index passed to `LightAccount::new_init`.
    pub output_state_tree_index: u8,
}

impl StagedLightArgs {
    pub(crate) fn to_validity_proof(self) -> Result<ValidityProof> {
        if self.proof_present {
            let proof = CompressedProof::try_from(self.proof_bytes.as_ref())
                .map_err(|_| error!(ZkSettleError::HookPayloadInvalid))?;
            Ok(ValidityProof(Some(proof)))
        } else {
            Ok(ValidityProof(None))
        }
    }

    pub(crate) fn to_tree_info(self) -> PackedAddressTreeInfo {
        PackedAddressTreeInfo {
            address_merkle_tree_pubkey_index: self.address_mt_index,
            address_queue_pubkey_index: self.address_queue_index,
            root_index: self.address_root_index,
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct HookPayload {
    pub issuer: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub epoch: u64,
    pub light_args: StagedLightArgs,
    #[max_len(MAX_HOOK_PROOF_BYTES)]
    pub proof_and_witness: Vec<u8>,
    pub bump: u8,
}

/// Anchor-serializable mirror of `spl_tlv_account_resolution::account::ExtraAccountMeta`.
/// Clients submit an ordered list; the program converts and writes the TLV.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct ExtraAccountMetaInput {
    pub discriminator: u8,
    pub address_config: [u8; 32],
    pub is_signer: bool,
    pub is_writable: bool,
}

impl From<ExtraAccountMetaInput> for ExtraAccountMeta {
    fn from(m: ExtraAccountMetaInput) -> Self {
        Self {
            discriminator: m.discriminator,
            address_config: m.address_config,
            is_signer: m.is_signer.into(),
            is_writable: m.is_writable.into(),
        }
    }
}
