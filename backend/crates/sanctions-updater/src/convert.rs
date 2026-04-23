use ark_bn254::Fr;
use ark_ff::{BigInteger, PrimeField};

use crate::error::UpdaterError;

fn reverse_bytes(src: &[u8; 32]) -> [u8; 32] {
    let mut out = [0u8; 32];
    for (i, b) in src.iter().enumerate() {
        out[31 - i] = *b;
    }
    out
}

pub fn fr_to_bytes_be(f: &Fr) -> [u8; 32] {
    let repr = f.into_bigint();
    let le: [u8; 32] = repr.to_bytes_le().try_into().expect("Fr is 32 bytes");
    reverse_bytes(&le)
}

pub fn bytes_be_to_fr(bytes: &[u8; 32]) -> Fr {
    Fr::from_le_bytes_mod_order(&reverse_bytes(bytes))
}

pub fn wallet_to_fr(hex_str: &str) -> Result<Fr, UpdaterError> {
    let hex_str = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    let bytes = hex::decode(hex_str).map_err(|e| UpdaterError::InvalidHex(e.to_string()))?;
    if bytes.len() != 32 {
        return Err(UpdaterError::InvalidHex(format!(
            "expected 32 bytes, got {}",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(bytes_be_to_fr(&arr))
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
}
