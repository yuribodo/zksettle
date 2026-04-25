use ark_bn254::Fr;
use ark_ff::{BigInteger, PrimeField};

use crate::error::ServiceError;

pub fn fr_to_bytes_be(f: &Fr) -> [u8; 32] {
    let repr = f.into_bigint();
    let le = repr.to_bytes_le();
    let mut be = [0u8; 32];
    for (i, b) in le.iter().enumerate() {
        be[31 - i] = *b;
    }
    be
}

pub fn bytes_be_to_fr(bytes: &[u8; 32]) -> Fr {
    let mut le = [0u8; 32];
    for (i, b) in bytes.iter().enumerate() {
        le[31 - i] = *b;
    }
    Fr::from_le_bytes_mod_order(&le)
}

pub fn wallet_to_fr(hex_str: &str) -> Result<Fr, ServiceError> {
    let hex_str = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    let bytes = hex::decode(hex_str).map_err(|e| ServiceError::InvalidHex(e.to_string()))?;
    if bytes.len() != 32 {
        return Err(ServiceError::InvalidHex(format!(
            "expected 32 bytes, got {}",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(bytes_be_to_fr(&arr))
}

pub fn wallet_hex_to_bytes(hex_str: &str) -> Result<[u8; 32], ServiceError> {
    let hex_str = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    let bytes = hex::decode(hex_str).map_err(|e| ServiceError::InvalidHex(e.to_string()))?;
    if bytes.len() != 32 {
        return Err(ServiceError::InvalidHex(format!(
            "expected 32 bytes, got {}",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ark_ff::AdditiveGroup;

    #[test]
    fn roundtrip_fr_bytes() {
        let original = Fr::from(42u64);
        let bytes = fr_to_bytes_be(&original);
        let recovered = bytes_be_to_fr(&bytes);
        assert_eq!(original, recovered);
    }

    #[test]
    fn zero_roundtrip() {
        let bytes = fr_to_bytes_be(&Fr::ZERO);
        assert_eq!(bytes_be_to_fr(&bytes), Fr::ZERO);
    }

    #[test]
    fn wallet_to_fr_with_prefix() {
        let hex = format!("0x{}", hex::encode([1u8; 32]));
        let fr = wallet_to_fr(&hex).unwrap();
        let back = fr_to_bytes_be(&fr);
        assert_eq!(back, [1u8; 32]);
    }

    #[test]
    fn wallet_to_fr_rejects_short() {
        assert!(wallet_to_fr("0xabcd").is_err());
    }

    #[test]
    fn wallet_to_fr_without_prefix() {
        let hex_str = hex::encode([2u8; 32]);
        let fr = wallet_to_fr(&hex_str).unwrap();
        let back = fr_to_bytes_be(&fr);
        assert_eq!(back, [2u8; 32]);
    }

    #[test]
    fn wallet_to_fr_invalid_hex() {
        assert!(wallet_to_fr("0xZZZZ").is_err());
    }

    #[test]
    fn wallet_hex_to_bytes_ok() {
        let input = hex::encode([3u8; 32]);
        let result = wallet_hex_to_bytes(&input).unwrap();
        assert_eq!(result, [3u8; 32]);
    }

    #[test]
    fn wallet_hex_to_bytes_with_prefix() {
        let input = format!("0x{}", hex::encode([4u8; 32]));
        let result = wallet_hex_to_bytes(&input).unwrap();
        assert_eq!(result, [4u8; 32]);
    }

    #[test]
    fn wallet_hex_to_bytes_wrong_length() {
        assert!(wallet_hex_to_bytes("aabb").is_err());
    }

    #[test]
    fn wallet_hex_to_bytes_invalid_hex() {
        assert!(wallet_hex_to_bytes("0xnothex").is_err());
    }

    #[test]
    fn fr_to_bytes_be_is_big_endian() {
        let f = Fr::from(1u64);
        let bytes = fr_to_bytes_be(&f);
        assert_eq!(bytes[31], 1);
        assert_eq!(bytes[0], 0);
    }
}
