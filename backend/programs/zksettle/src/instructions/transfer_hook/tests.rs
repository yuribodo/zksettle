#![cfg(test)]

use anchor_lang::error::ERROR_CODE_OFFSET;
use anchor_lang::prelude::*;

use crate::constants::MAX_ROOT_AGE_SLOTS;
use crate::error::ZkSettleError;
use crate::instructions::verify_proof::{EPOCH_LEN_SECS, MAX_EPOCH_LAG};

use super::handlers::validate_set_hook_inputs;
use super::settlement::validate_settlement_guards;
use super::types::{ExtraAccountMetaInput, HookPayload, StagedLightArgs, MAX_HOOK_PROOF_BYTES};

fn err_code<T: std::fmt::Debug>(r: Result<T>) -> u32 {
    match r {
        Err(anchor_lang::error::Error::AnchorError(e)) => e.error_code_number,
        other => panic!("expected AnchorError, got {other:?}"),
    }
}

fn nonzero_nullifier() -> [u8; 32] {
    let mut n = [0u8; 32];
    n[0] = 1;
    n
}

#[test]
fn validate_accepts_well_formed_inputs() {
    assert!(validate_set_hook_inputs(256, &nonzero_nullifier(), 10).is_ok());
}

#[test]
fn validate_rejects_zero_nullifier() {
    assert_eq!(
        err_code(validate_set_hook_inputs(256, &[0u8; 32], 10)),
        ERROR_CODE_OFFSET + ZkSettleError::ZeroNullifier as u32,
    );
}

#[test]
fn validate_rejects_zero_amount() {
    assert_eq!(
        err_code(validate_set_hook_inputs(256, &nonzero_nullifier(), 0)),
        ERROR_CODE_OFFSET + ZkSettleError::InvalidTransferAmount as u32,
    );
}

#[test]
fn validate_rejects_empty_proof() {
    assert_eq!(
        err_code(validate_set_hook_inputs(0, &nonzero_nullifier(), 10)),
        ERROR_CODE_OFFSET + ZkSettleError::HookPayloadInvalid as u32,
    );
}

#[test]
fn validate_rejects_oversized_proof() {
    assert_eq!(
        err_code(validate_set_hook_inputs(
            MAX_HOOK_PROOF_BYTES + 1,
            &nonzero_nullifier(),
            10
        )),
        ERROR_CODE_OFFSET + ZkSettleError::HookPayloadInvalid as u32,
    );
}

#[test]
fn validate_accepts_max_proof_len() {
    assert!(validate_set_hook_inputs(MAX_HOOK_PROOF_BYTES, &nonzero_nullifier(), 1).is_ok());
}

#[test]
fn staged_args_roundtrip_tree_info() {
    let args = StagedLightArgs {
        bubblegum_tail: 0,
        proof_present: false,
        proof_bytes: [0u8; 128],
        address_mt_index: 7,
        address_queue_index: 9,
        address_root_index: 42,
        output_state_tree_index: 3,
    };
    let info = args.to_tree_info();
    assert_eq!(info.address_merkle_tree_pubkey_index, 7);
    assert_eq!(info.address_queue_pubkey_index, 9);
    assert_eq!(info.root_index, 42);
}

#[test]
fn staged_args_roundtrip_validity_proof_absent() {
    let args = StagedLightArgs {
        bubblegum_tail: 0,
        proof_present: false,
        proof_bytes: [0u8; 128],
        address_mt_index: 0,
        address_queue_index: 0,
        address_root_index: 0,
        output_state_tree_index: 0,
    };
    assert!(args.to_validity_proof().unwrap().0.is_none());
}

#[test]
fn staged_args_roundtrip_validity_proof_present() {
    let mut proof_bytes = [0u8; 128];
    for (i, b) in proof_bytes.iter_mut().enumerate() {
        *b = i as u8;
    }
    let args = StagedLightArgs {
        bubblegum_tail: 0,
        proof_present: true,
        proof_bytes,
        address_mt_index: 0,
        address_queue_index: 0,
        address_root_index: 0,
        output_state_tree_index: 0,
    };
    let vp = args.to_validity_proof().unwrap();
    let inner = vp.0.expect("proof present");
    assert_eq!(inner.a, proof_bytes[0..32]);
    assert_eq!(inner.b, proof_bytes[32..96]);
    assert_eq!(inner.c, proof_bytes[96..128]);
}

#[test]
fn extra_account_meta_input_converts_to_spl_pubkey_variant() {
    use spl_tlv_account_resolution::account::ExtraAccountMeta;

    let pk = [7u8; 32];
    let input = ExtraAccountMetaInput {
        discriminator: 0,
        address_config: pk,
        is_signer: false,
        is_writable: true,
    };
    let m: ExtraAccountMeta = input.into();
    assert_eq!(m.discriminator, 0);
    assert_eq!(m.address_config, pk);
    assert!(!bool::from(m.is_signer));
    assert!(bool::from(m.is_writable));
}

#[test]
fn hook_payload_init_space_fits_max_proof() {
    // Sanity: InitSpace accounts for the MAX_HOOK_PROOF_BYTES ceiling plus
    // all fixed fields. If a field is added without updating InitSpace via
    // #[max_len], the derive would under-report and `init` would fail at
    // runtime with AccountDidNotSerialize.
    let fixed = 32 + 32 + 32 + 32 + 8 + 8
        + StagedLightArgs::INIT_SPACE
        + 4 /* Vec prefix */ + MAX_HOOK_PROOF_BYTES + 1;
    assert_eq!(HookPayload::INIT_SPACE, fixed);
}

mod settlement_guards {
    use super::*;

    fn base() -> (Pubkey, Pubkey, u64, u64, u64, u64, i64) {
        let mint = Pubkey::new_unique();
        let recipient = Pubkey::new_unique();
        let amount = 1_000u64;
        let epoch = 10u64;
        let issuer_root_slot = 500u64;
        let current_slot = 500u64;
        let unix_timestamp = EPOCH_LEN_SECS * epoch as i64;
        (
            mint,
            recipient,
            amount,
            epoch,
            issuer_root_slot,
            current_slot,
            unix_timestamp,
        )
    }

    #[test]
    fn accepts_matching_inputs() {
        let (mint, recipient, amount, epoch, root_slot, slot, ts) = base();
        assert!(validate_settlement_guards(
            &mint, &recipient, amount, epoch, &mint, &recipient, amount, root_slot, slot, ts,
        )
        .is_ok());
    }

    #[test]
    fn rejects_zero_amount() {
        let (mint, recipient, _amount, epoch, root_slot, slot, ts) = base();
        assert_eq!(
            err_code(validate_settlement_guards(
                &mint, &recipient, 0, epoch, &mint, &recipient, 0, root_slot, slot, ts,
            )),
            ERROR_CODE_OFFSET + ZkSettleError::InvalidTransferAmount as u32,
        );
    }

    #[test]
    fn rejects_mint_mismatch() {
        let (mint, recipient, amount, epoch, root_slot, slot, ts) = base();
        let wrong_mint = Pubkey::new_unique();
        assert_eq!(
            err_code(validate_settlement_guards(
                &mint, &recipient, amount, epoch, &wrong_mint, &recipient, amount, root_slot, slot,
                ts,
            )),
            ERROR_CODE_OFFSET + ZkSettleError::MintMismatch as u32,
        );
    }

    #[test]
    fn rejects_recipient_mismatch() {
        let (mint, recipient, amount, epoch, root_slot, slot, ts) = base();
        let wrong_rcpt = Pubkey::new_unique();
        assert_eq!(
            err_code(validate_settlement_guards(
                &mint, &recipient, amount, epoch, &mint, &wrong_rcpt, amount, root_slot, slot, ts,
            )),
            ERROR_CODE_OFFSET + ZkSettleError::RecipientMismatch as u32,
        );
    }

    #[test]
    fn rejects_amount_mismatch() {
        let (mint, recipient, amount, epoch, root_slot, slot, ts) = base();
        assert_eq!(
            err_code(validate_settlement_guards(
                &mint,
                &recipient,
                amount,
                epoch,
                &mint,
                &recipient,
                amount + 1,
                root_slot,
                slot,
                ts,
            )),
            ERROR_CODE_OFFSET + ZkSettleError::AmountMismatch as u32,
        );
    }

    #[test]
    fn rejects_stale_root() {
        let (mint, recipient, amount, epoch, root_slot, _slot, ts) = base();
        let stale_slot = root_slot + MAX_ROOT_AGE_SLOTS + 1;
        assert_eq!(
            err_code(validate_settlement_guards(
                &mint, &recipient, amount, epoch, &mint, &recipient, amount, root_slot,
                stale_slot, ts,
            )),
            ERROR_CODE_OFFSET + ZkSettleError::RootStale as u32,
        );
    }

    #[test]
    fn accepts_root_at_max_age() {
        let (mint, recipient, amount, epoch, root_slot, _slot, ts) = base();
        let slot = root_slot + MAX_ROOT_AGE_SLOTS;
        assert!(validate_settlement_guards(
            &mint, &recipient, amount, epoch, &mint, &recipient, amount, root_slot, slot, ts,
        )
        .is_ok());
    }

    #[test]
    fn rejects_epoch_in_future() {
        let (mint, recipient, amount, _epoch, root_slot, slot, ts) = base();
        let future_epoch = (ts / EPOCH_LEN_SECS) as u64 + 1;
        assert_eq!(
            err_code(validate_settlement_guards(
                &mint,
                &recipient,
                amount,
                future_epoch,
                &mint,
                &recipient,
                amount,
                root_slot,
                slot,
                ts,
            )),
            ERROR_CODE_OFFSET + ZkSettleError::EpochInFuture as u32,
        );
    }

    #[test]
    fn rejects_epoch_stale() {
        let (mint, recipient, amount, _epoch, root_slot, slot, ts) = base();
        let current_epoch = (ts / EPOCH_LEN_SECS) as u64;
        let stale_epoch = current_epoch.saturating_sub(MAX_EPOCH_LAG + 1);
        assert_eq!(
            err_code(validate_settlement_guards(
                &mint,
                &recipient,
                amount,
                stale_epoch,
                &mint,
                &recipient,
                amount,
                root_slot,
                slot,
                ts,
            )),
            ERROR_CODE_OFFSET + ZkSettleError::EpochStale as u32,
        );
    }

    #[test]
    fn accepts_epoch_at_max_lag() {
        let (mint, recipient, amount, _epoch, root_slot, slot, ts) = base();
        let current_epoch = (ts / EPOCH_LEN_SECS) as u64;
        let lagged = current_epoch - MAX_EPOCH_LAG;
        assert!(validate_settlement_guards(
            &mint, &recipient, amount, lagged, &mint, &recipient, amount, root_slot, slot, ts,
        )
        .is_ok());
    }

    #[test]
    fn staged_args_validity_proof_present_all_zeros() {
        let args = StagedLightArgs {
            bubblegum_tail: 0,
            proof_present: true,
            proof_bytes: [0u8; 128],
            address_mt_index: 0,
            address_queue_index: 0,
            address_root_index: 0,
            output_state_tree_index: 0,
        };
        let vp = args.to_validity_proof().unwrap();
        assert!(vp.0.is_some());
    }

    #[test]
    fn staged_args_validity_proof_absent_ignores_garbage() {
        let args = StagedLightArgs {
            bubblegum_tail: 0,
            proof_present: false,
            proof_bytes: [0xff; 128],
            address_mt_index: 255,
            address_queue_index: 255,
            address_root_index: 65535,
            output_state_tree_index: 255,
        };
        assert!(args.to_validity_proof().unwrap().0.is_none());
    }
}
