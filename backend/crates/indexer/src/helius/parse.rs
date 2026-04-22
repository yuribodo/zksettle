use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use borsh::BorshDeserialize;
use sha2::{Digest, Sha256};
use zksettle_types::ProofSettled;

use crate::error::IndexerError;

const DISCRIMINATOR_LEN: usize = 8;

fn event_discriminator() -> [u8; 8] {
    let hash = Sha256::digest(b"event:ProofSettled");
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&hash[..8]);
    disc
}

pub fn extract_proof_settled(log_messages: &[String]) -> Result<Vec<ProofSettled>, IndexerError> {
    if log_messages.is_empty() {
        return Err(IndexerError::MissingEvents);
    }

    let disc = event_discriminator();
    let mut events = Vec::new();

    for line in log_messages {
        let Some(data_b64) = line.strip_prefix("Program data: ") else {
            continue;
        };

        let data = STANDARD.decode(data_b64)?;

        if data.len() < DISCRIMINATOR_LEN {
            continue;
        }
        if data[..DISCRIMINATOR_LEN] != disc {
            continue;
        }

        let event = ProofSettled::try_from_slice(&data[DISCRIMINATOR_LEN..])
            .map_err(|e| IndexerError::BorshDeserialize(e.to_string()))?;
        events.push(event);
    }

    Ok(events)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    fn make_test_event() -> ProofSettled {
        ProofSettled {
            issuer: [9u8; 32],
            nullifier_hash: [8u8; 32],
            merkle_root: [7u8; 32],
            sanctions_root: [11u8; 32],
            jurisdiction_root: [12u8; 32],
            mint: [5u8; 32],
            recipient: [4u8; 32],
            amount: 2_500_000,
            epoch: 7,
            timestamp: 1_700_000_001,
            slot: 1_234,
            payer: [6u8; 32],
        }
    }

    fn encode_event(event: &ProofSettled) -> String {
        let disc = event_discriminator();
        let body = borsh::to_vec(event).unwrap();
        let mut buf = Vec::with_capacity(disc.len() + body.len());
        buf.extend_from_slice(&disc);
        buf.extend_from_slice(&body);
        format!("Program data: {}", STANDARD.encode(&buf))
    }

    #[test]
    fn discriminator_is_stable() {
        let d1 = event_discriminator();
        let d2 = event_discriminator();
        assert_eq!(d1, d2);
        assert_ne!(d1, [0u8; 8]);
    }

    #[test]
    fn parse_valid_event() {
        let event = make_test_event();
        let logs = vec![
            "Program log: Instruction: VerifyProof".into(),
            encode_event(&event),
        ];
        let result = extract_proof_settled(&logs).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], event);
    }

    #[test]
    fn no_program_data_lines() {
        let logs = vec!["Program log: something".into()];
        let result = extract_proof_settled(&logs).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn empty_logs_returns_error() {
        let err = extract_proof_settled(&[]).unwrap_err();
        assert!(matches!(err, IndexerError::MissingEvents));
    }

    #[test]
    fn invalid_base64() {
        let logs = vec!["Program data: !!!invalid!!!".into()];
        let err = extract_proof_settled(&logs).unwrap_err();
        assert!(matches!(err, IndexerError::Base64Decode(_)));
    }

    #[test]
    fn truncated_data_skipped() {
        let short = STANDARD.encode([0u8; 4]);
        let logs = vec![format!("Program data: {short}")];
        let result = extract_proof_settled(&logs).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn wrong_discriminator_skipped() {
        let mut data = vec![0xFFu8; 8];
        data.extend_from_slice(&borsh::to_vec(&make_test_event()).unwrap());
        let logs = vec![format!("Program data: {}", STANDARD.encode(&data))];
        let result = extract_proof_settled(&logs).unwrap();
        assert!(result.is_empty());
    }
}
