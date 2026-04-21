use anchor_lang::prelude::*;
use gnark_verifier_solana::{proof::GnarkProof, verifier::GnarkVerifier, witness::GnarkWitness};
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
use crate::generated_vk::VK;
use crate::state::{
    compressed::{CompressedAttestation, CompressedNullifier},
    Issuer, AMOUNT_IDX, ATTESTATION_SEED, EPOCH_IDX, ISSUER_SEED, MERKLE_ROOT_IDX, MINT_HI_IDX,
    MINT_LO_IDX, NULLIFIER_IDX, NULLIFIER_SEED, RECIPIENT_HI_IDX, RECIPIENT_LO_IDX,
};

const GNARK_WITNESS_HEADER_LEN: usize = 12;

pub const EPOCH_LEN_SECS: i64 = 86_400;
pub const MAX_EPOCH_LAG: u64 = 1;

pub(crate) const fn expected_witness_len(nr_inputs: usize) -> usize {
    GNARK_WITNESS_HEADER_LEN + nr_inputs * 32
}

#[cfg(not(feature = "placeholder-vk"))]
const _: () = assert!(
    VK.nr_pubinputs == 8,
    "ADR-020 VK must expose exactly 8 public inputs",
);

fn split_proof_and_witness(data: &[u8], witness_len: usize) -> Result<(&[u8], &[u8])> {
    if data.len() <= witness_len {
        return err!(ZkSettleError::MalformedProof);
    }
    Ok(data.split_at(data.len() - witness_len))
}

pub fn pubkey_to_limbs(pk: &Pubkey) -> ([u8; 32], [u8; 32]) {
    let bytes = pk.to_bytes();
    let mut hi = [0u8; 32];
    let mut lo = [0u8; 32];
    hi[16..32].copy_from_slice(&bytes[0..16]);
    lo[16..32].copy_from_slice(&bytes[16..32]);
    (lo, hi)
}

pub fn u64_to_field_bytes(x: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[24..32].copy_from_slice(&x.to_be_bytes());
    out
}

#[cfg_attr(feature = "placeholder-vk", allow(dead_code))]
pub(crate) struct BindingInputs<'a> {
    pub merkle_root: &'a [u8; 32],
    pub nullifier_hash: &'a [u8; 32],
    pub mint: &'a Pubkey,
    pub epoch: u64,
    pub recipient: &'a Pubkey,
    pub amount: u64,
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
        witness.entries[RECIPIENT_LO_IDX] == rcpt_lo
            && witness.entries[RECIPIENT_HI_IDX] == rcpt_hi,
        ZkSettleError::RecipientMismatch
    );

    require!(
        witness.entries[AMOUNT_IDX] == u64_to_field_bytes(inputs.amount),
        ZkSettleError::AmountMismatch
    );

    Ok(())
}

/// Parse `proof_and_witness`, rebind public inputs to `BindingInputs`, and run
/// the Groth16 pairing check. Returns `Ok(())` only if every binding matches
/// and the proof verifies. Shared by `verify_proof` handler and the Token-2022
/// transfer hook.
pub(crate) fn verify_bundle(
    proof_and_witness: &[u8],
    bindings: &BindingInputs<'_>,
) -> Result<()> {
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

#[derive(Accounts)]
pub struct VerifyProof<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, issuer.authority.as_ref()],
        bump = issuer.bump,
        constraint = Clock::get()?.slot.saturating_sub(issuer.root_slot) <= crate::constants::MAX_ROOT_AGE_SLOTS
            @ ZkSettleError::RootStale,
    )]
    pub issuer: Account<'info, Issuer>,

    pub system_program: Program<'info, System>,
}

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
    require!(clock.unix_timestamp >= 0, ZkSettleError::NegativeClock);
    let current_epoch = (clock.unix_timestamp / EPOCH_LEN_SECS) as u64;
    require!(epoch <= current_epoch, ZkSettleError::EpochInFuture);
    require!(
        current_epoch.saturating_sub(epoch) <= MAX_EPOCH_LAG,
        ZkSettleError::EpochStale
    );

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
        .map_err(crate::map_light_err!("get_tree_pubkey failed", ZkSettleError::InvalidLightAddress))?;

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

    let null_params = address_tree_info.into_new_address_params_assigned_packed(null_seed, Some(0));
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
        .map_err(crate::map_light_err!("with_light_account nullifier", ZkSettleError::LightAccountPackFailed))?
        .with_light_account(attestation_account)
        .map_err(crate::map_light_err!("with_light_account attestation", ZkSettleError::LightAccountPackFailed))?
        .invoke(light_cpi_accounts)
        .map_err(crate::map_light_err!("Light CPI invoke failed", ZkSettleError::LightInvokeFailed))?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::error::ERROR_CODE_OFFSET;

    fn err_code<T: std::fmt::Debug>(r: Result<T>) -> u32 {
        match r {
            Err(anchor_lang::error::Error::AnchorError(e)) => e.error_code_number,
            other => panic!("expected AnchorError, got {other:?}"),
        }
    }

    #[test]
    fn rejects_empty_proof_at_exact_witness_len() {
        let witness_len = expected_witness_len(4);
        let buf = vec![0u8; witness_len];
        assert_eq!(
            err_code(split_proof_and_witness(&buf, witness_len)),
            ERROR_CODE_OFFSET + ZkSettleError::MalformedProof as u32,
        );
    }

    #[test]
    fn rejects_short_buffer() {
        let witness_len = expected_witness_len(4);
        let buf = vec![0u8; witness_len - 1];
        assert_eq!(
            err_code(split_proof_and_witness(&buf, witness_len)),
            ERROR_CODE_OFFSET + ZkSettleError::MalformedProof as u32,
        );
    }

    #[test]
    fn splits_one_byte_proof() {
        let witness_len = expected_witness_len(2);
        let mut buf = vec![0u8; witness_len + 1];
        buf[0] = 0xaa;
        let (proof, witness) = split_proof_and_witness(&buf, witness_len).unwrap();
        assert_eq!(proof, &[0xaa]);
        assert_eq!(witness.len(), witness_len);
    }

    #[test]
    fn u64_field_bytes_are_big_endian() {
        let b = u64_to_field_bytes(0x0102_0304_0506_0708);
        assert_eq!(&b[..24], &[0u8; 24]);
        assert_eq!(&b[24..], &[1, 2, 3, 4, 5, 6, 7, 8]);
    }

    #[test]
    fn pubkey_limbs_roundtrip() {
        let mut raw = [0u8; 32];
        for (i, b) in raw.iter_mut().enumerate() {
            *b = i as u8;
        }
        let pk = Pubkey::new_from_array(raw);
        let (lo, hi) = pubkey_to_limbs(&pk);
        assert_eq!(&hi[..16], &[0u8; 16]);
        assert_eq!(&hi[16..], &raw[0..16]);
        assert_eq!(&lo[..16], &[0u8; 16]);
        assert_eq!(&lo[16..], &raw[16..32]);
    }

    mod bindings {
        use super::*;

        fn witness_for(
            root: [u8; 32],
            nullifier: [u8; 32],
            mint: &Pubkey,
            epoch: u64,
            recipient: &Pubkey,
            amount: u64,
        ) -> GnarkWitness<8> {
            let (mint_lo, mint_hi) = pubkey_to_limbs(mint);
            let (rcpt_lo, rcpt_hi) = pubkey_to_limbs(recipient);
            let mut entries = [[0u8; 32]; 8];
            entries[MERKLE_ROOT_IDX] = root;
            entries[NULLIFIER_IDX] = nullifier;
            entries[MINT_LO_IDX] = mint_lo;
            entries[MINT_HI_IDX] = mint_hi;
            entries[EPOCH_IDX] = u64_to_field_bytes(epoch);
            entries[RECIPIENT_LO_IDX] = rcpt_lo;
            entries[RECIPIENT_HI_IDX] = rcpt_hi;
            entries[AMOUNT_IDX] = u64_to_field_bytes(amount);
            GnarkWitness { entries }
        }

        struct Sample {
            root: [u8; 32],
            nul: [u8; 32],
            mint: Pubkey,
            epoch: u64,
            rcpt: Pubkey,
            amt: u64,
        }

        fn sample() -> Sample {
            Sample {
                root: [1u8; 32],
                nul: [2u8; 32],
                mint: Pubkey::new_unique(),
                epoch: 42,
                rcpt: Pubkey::new_unique(),
                amt: 1_000,
            }
        }

        impl Sample {
            fn inputs(&self) -> BindingInputs<'_> {
                BindingInputs {
                    merkle_root: &self.root,
                    nullifier_hash: &self.nul,
                    mint: &self.mint,
                    epoch: self.epoch,
                    recipient: &self.rcpt,
                    amount: self.amt,
                }
            }

            fn witness(&self) -> GnarkWitness<8> {
                witness_for(self.root, self.nul, &self.mint, self.epoch, &self.rcpt, self.amt)
            }
        }

        #[test]
        fn accepts_matching_tuple() {
            let s = sample();
            assert!(check_bindings(&s.witness(), &s.inputs()).is_ok());
        }

        #[test]
        fn rejects_root_mismatch() {
            let s = sample();
            let other = [9u8; 32];
            let mut inputs = s.inputs();
            inputs.merkle_root = &other;
            assert_eq!(
                err_code(check_bindings(&s.witness(), &inputs)),
                ERROR_CODE_OFFSET + ZkSettleError::MerkleRootMismatch as u32,
            );
        }

        #[test]
        fn rejects_nullifier_mismatch() {
            let s = sample();
            let other = [9u8; 32];
            let mut inputs = s.inputs();
            inputs.nullifier_hash = &other;
            assert_eq!(
                err_code(check_bindings(&s.witness(), &inputs)),
                ERROR_CODE_OFFSET + ZkSettleError::NullifierMismatch as u32,
            );
        }

        #[test]
        fn rejects_mint_mismatch() {
            let s = sample();
            let other = Pubkey::new_unique();
            let mut inputs = s.inputs();
            inputs.mint = &other;
            assert_eq!(
                err_code(check_bindings(&s.witness(), &inputs)),
                ERROR_CODE_OFFSET + ZkSettleError::MintMismatch as u32,
            );
        }

        #[test]
        fn rejects_epoch_mismatch() {
            let s = sample();
            let mut inputs = s.inputs();
            inputs.epoch += 1;
            assert_eq!(
                err_code(check_bindings(&s.witness(), &inputs)),
                ERROR_CODE_OFFSET + ZkSettleError::EpochMismatch as u32,
            );
        }

        #[test]
        fn rejects_recipient_mismatch() {
            let s = sample();
            let other = Pubkey::new_unique();
            let mut inputs = s.inputs();
            inputs.recipient = &other;
            assert_eq!(
                err_code(check_bindings(&s.witness(), &inputs)),
                ERROR_CODE_OFFSET + ZkSettleError::RecipientMismatch as u32,
            );
        }

        #[test]
        fn rejects_amount_mismatch() {
            let s = sample();
            let mut inputs = s.inputs();
            inputs.amount += 1;
            assert_eq!(
                err_code(check_bindings(&s.witness(), &inputs)),
                ERROR_CODE_OFFSET + ZkSettleError::AmountMismatch as u32,
            );
        }
    }
}
