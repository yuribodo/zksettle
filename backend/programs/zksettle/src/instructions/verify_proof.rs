use anchor_lang::prelude::*;
use gnark_verifier_solana::{proof::GnarkProof, verifier::GnarkVerifier, witness::GnarkWitness};

use crate::error::ZkSettleError;
use crate::generated_vk::VK;
use crate::state::{
    Attestation, Issuer, Nullifier, AMOUNT_IDX, ATTESTATION_SEED, EPOCH_IDX, ISSUER_SEED,
    MERKLE_ROOT_IDX, MINT_HI_IDX, MINT_LO_IDX, NULLIFIER_IDX, NULLIFIER_SEED, RECIPIENT_HI_IDX,
    RECIPIENT_LO_IDX,
};

// gnark-verifier-solana serializes a witness as a 12-byte header followed by
// `nr_pubinputs` 32-byte field elements.
const GNARK_WITNESS_HEADER_LEN: usize = 12;

/// Maximum age (in slots) of an issuer's merkle root before `verify_proof`
/// rejects it. ~48h at 400ms/slot on Solana mainnet-beta.
pub const MAX_ROOT_AGE_SLOTS: u64 = 432_000;

/// 24h epoch length (seconds) used by ADR-020 context binding.
pub const EPOCH_LEN_SECS: i64 = 86_400;

/// Allowed lag (in epochs) between the proof's epoch and the current epoch.
/// `1` means yesterday's proofs still verify, tomorrow's are rejected.
pub const MAX_EPOCH_LAG: u64 = 1;

pub(crate) const fn expected_witness_len(nr_inputs: usize) -> usize {
    GNARK_WITNESS_HEADER_LEN + nr_inputs * 32
}

// When the real ADR-020 VK is wired in, the witness must expose the full
// 8-slot public-input layout. Fail loudly at compile time otherwise.
#[cfg(not(feature = "placeholder-vk"))]
const _: () = assert!(
    VK.nr_pubinputs == 8,
    "ADR-020 VK must expose exactly 8 public inputs",
);

/// Split `proof_and_witness` into `(proof_bytes, witness_bytes)` or fail with
/// `MalformedProof` if the buffer cannot fit both a non-empty proof and the
/// fixed-size witness.
fn split_proof_and_witness(data: &[u8], witness_len: usize) -> Result<(&[u8], &[u8])> {
    if data.len() <= witness_len {
        return err!(ZkSettleError::MalformedProof);
    }
    Ok(data.split_at(data.len() - witness_len))
}

/// Split a 32-byte pubkey into (lo, hi) field-element limbs. Each limb is
/// a 32-byte big-endian buffer holding the low/high 16 bytes of the pubkey
/// zero-padded in the top half — safely inside BN254's ~254-bit scalar field.
pub fn pubkey_to_limbs(pk: &Pubkey) -> ([u8; 32], [u8; 32]) {
    let bytes = pk.to_bytes();
    let mut hi = [0u8; 32];
    let mut lo = [0u8; 32];
    hi[16..32].copy_from_slice(&bytes[0..16]);
    lo[16..32].copy_from_slice(&bytes[16..32]);
    (lo, hi)
}

/// Encode a `u64` as a 32-byte big-endian field element (top 24 bytes zero).
pub fn u64_to_field_bytes(x: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[24..32].copy_from_slice(&x.to_be_bytes());
    out
}

/// Bundle of every field the witness must publicly commit to: issuer merkle
/// root, instruction nullifier hash, and the ADR-020 context tuple.
#[cfg_attr(feature = "placeholder-vk", allow(dead_code))]
pub(crate) struct BindingInputs<'a> {
    pub merkle_root: &'a [u8; 32],
    pub nullifier_hash: &'a [u8; 32],
    pub mint: &'a Pubkey,
    pub epoch: u64,
    pub recipient: &'a Pubkey,
    pub amount: u64,
}

/// Enforce that the witness publicly commits to every field in `inputs`.
/// Compiled unconditionally so unit tests run under the default feature set;
/// the call site in `handler` stays cfg-gated.
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

#[derive(Accounts)]
#[instruction(
    proof_and_witness: Vec<u8>,
    nullifier_hash: [u8; 32],
    mint: Pubkey,
    epoch: u64,
    recipient: Pubkey,
    amount: u64,
)]
pub struct VerifyProof<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, issuer.authority.as_ref()],
        bump = issuer.bump,
        constraint = Clock::get()?.slot.saturating_sub(issuer.root_slot) <= MAX_ROOT_AGE_SLOTS
            @ ZkSettleError::RootStale,
    )]
    pub issuer: Account<'info, Issuer>,

    #[account(
        init,
        payer = payer,
        space = 8 + Nullifier::LEN,
        seeds = [NULLIFIER_SEED, issuer.key().as_ref(), nullifier_hash.as_ref()],
        bump,
        constraint = nullifier_hash != [0u8; 32] @ ZkSettleError::ZeroNullifier,
    )]
    pub nullifier: Account<'info, Nullifier>,

    #[account(
        init,
        payer = payer,
        space = 8 + Attestation::LEN,
        seeds = [ATTESTATION_SEED, issuer.key().as_ref(), nullifier_hash.as_ref()],
        bump,
    )]
    pub attestation: Account<'info, Attestation>,

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

pub fn handler(
    ctx: Context<VerifyProof>,
    proof_and_witness: Vec<u8>,
    nullifier_hash: [u8; 32],
    mint: Pubkey,
    epoch: u64,
    recipient: Pubkey,
    amount: u64,
) -> Result<()> {
    const NR_INPUTS: usize = VK.nr_pubinputs;
    const N_COMMITMENTS: usize = VK.commitment_keys.len();

    // Epoch freshness: reject proofs for future epochs or those older than
    // MAX_EPOCH_LAG. `unix_timestamp` is i64 and could theoretically be
    // negative on test validators; treat that as "future" for safety.
    let ts = Clock::get()?.unix_timestamp;
    require!(ts >= 0, ZkSettleError::EpochInFuture);
    let current_epoch = (ts / EPOCH_LEN_SECS) as u64;
    require!(epoch <= current_epoch, ZkSettleError::EpochInFuture);
    require!(
        current_epoch.saturating_sub(epoch) <= MAX_EPOCH_LAG,
        ZkSettleError::EpochStale
    );

    let witness_len = expected_witness_len(NR_INPUTS);
    let (proof_bytes, witness_bytes) = split_proof_and_witness(&proof_and_witness, witness_len)?;

    let proof = GnarkProof::<N_COMMITMENTS>::from_bytes(proof_bytes).map_err(|e| {
        msg!("Gnark proof parse error: {:?}", e);
        error!(ZkSettleError::MalformedProof)
    })?;

    let witness = GnarkWitness::from_bytes(witness_bytes).map_err(|e| {
        msg!("Gnark witness parse error: {:?}", e);
        error!(ZkSettleError::MalformedProof)
    })?;

    #[cfg(not(feature = "placeholder-vk"))]
    check_bindings(
        &witness,
        &BindingInputs {
            merkle_root: &ctx.accounts.issuer.merkle_root,
            nullifier_hash: &nullifier_hash,
            mint: &mint,
            epoch,
            recipient: &recipient,
            amount,
        },
    )?;

    let mut verifier: GnarkVerifier<NR_INPUTS> = GnarkVerifier::new(&VK);

    verifier.verify(proof, witness).map_err(|e| {
        msg!("Proof verification failed: {:?}", e);
        error!(ZkSettleError::ProofInvalid)
    })?;

    let issuer_key = ctx.accounts.issuer.key();
    let merkle_root = ctx.accounts.issuer.merkle_root;
    let payer_key = ctx.accounts.payer.key();
    let slot = Clock::get()?.slot;

    let attestation = &mut ctx.accounts.attestation;
    attestation.issuer = issuer_key;
    attestation.nullifier_hash = nullifier_hash;
    attestation.merkle_root = merkle_root;
    attestation.mint = mint;
    attestation.recipient = recipient;
    attestation.amount = amount;
    attestation.epoch = epoch;
    attestation.slot = slot;
    attestation.payer = payer_key;
    attestation.bump = ctx.bumps.attestation;

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
