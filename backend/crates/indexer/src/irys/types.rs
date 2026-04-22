use serde::Serialize;
use zksettle_types::ProofSettled;

#[derive(Debug, Clone, Serialize)]
pub struct AttestationRecord {
    pub issuer: String,
    pub nullifier_hash: String,
    pub merkle_root: String,
    pub sanctions_root: String,
    pub jurisdiction_root: String,
    pub mint: String,
    pub recipient: String,
    pub amount: u64,
    pub epoch: u64,
    pub timestamp: u64,
    pub slot: u64,
    pub payer: String,
}

impl From<&ProofSettled> for AttestationRecord {
    fn from(e: &ProofSettled) -> Self {
        Self {
            issuer: bs58::encode(e.issuer).into_string(),
            nullifier_hash: hex::encode(e.nullifier_hash),
            merkle_root: hex::encode(e.merkle_root),
            sanctions_root: hex::encode(e.sanctions_root),
            jurisdiction_root: hex::encode(e.jurisdiction_root),
            mint: bs58::encode(e.mint).into_string(),
            recipient: bs58::encode(e.recipient).into_string(),
            amount: e.amount,
            epoch: e.epoch,
            timestamp: e.timestamp,
            slot: e.slot,
            payer: bs58::encode(e.payer).into_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ArweaveTag {
    pub name: String,
    pub value: String,
}

pub fn build_tags(event: &ProofSettled) -> Vec<ArweaveTag> {
    vec![
        ArweaveTag {
            name: "App-Name".into(),
            value: "zksettle-indexer".into(),
        },
        ArweaveTag {
            name: "Type".into(),
            value: "ProofSettled".into(),
        },
        ArweaveTag {
            name: "Nullifier-Hash".into(),
            value: hex::encode(event.nullifier_hash),
        },
        ArweaveTag {
            name: "Issuer".into(),
            value: bs58::encode(event.issuer).into_string(),
        },
        ArweaveTag {
            name: "Slot".into(),
            value: event.slot.to_string(),
        },
        ArweaveTag {
            name: "Mint".into(),
            value: bs58::encode(event.mint).into_string(),
        },
        ArweaveTag {
            name: "Recipient".into(),
            value: bs58::encode(event.recipient).into_string(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_event() -> ProofSettled {
        ProofSettled {
            issuer: [1u8; 32],
            nullifier_hash: [2u8; 32],
            merkle_root: [3u8; 32],
            sanctions_root: [4u8; 32],
            jurisdiction_root: [5u8; 32],
            mint: [6u8; 32],
            recipient: [7u8; 32],
            amount: 1_000_000,
            epoch: 3,
            timestamp: 1_700_000_000,
            slot: 500,
            payer: [8u8; 32],
        }
    }

    #[test]
    fn attestation_record_encoding() {
        let record = AttestationRecord::from(&test_event());
        assert_eq!(record.issuer, bs58::encode([1u8; 32]).into_string());
        assert_eq!(record.nullifier_hash, hex::encode([2u8; 32]));
        assert_eq!(record.amount, 1_000_000);
    }

    #[test]
    fn tags_contain_required_fields() {
        let tags = build_tags(&test_event());
        let names: Vec<&str> = tags.iter().map(|t| t.name.as_str()).collect();
        assert!(names.contains(&"App-Name"));
        assert!(names.contains(&"Type"));
        assert!(names.contains(&"Nullifier-Hash"));
        assert!(names.contains(&"Issuer"));
        assert!(names.contains(&"Slot"));
        assert!(names.contains(&"Mint"));
        assert!(names.contains(&"Recipient"));
    }

    #[test]
    fn json_roundtrip() {
        let record = AttestationRecord::from(&test_event());
        let json = serde_json::to_string(&record).unwrap();
        let _: serde_json::Value = serde_json::from_str(&json).unwrap();
    }
}
