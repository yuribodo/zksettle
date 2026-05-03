use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::GatewayError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub wallet: String,
    pub exp: u64,
    pub iat: u64,
}

pub fn issue(
    tenant_id: Uuid,
    wallet: &str,
    secret: &str,
    ttl_secs: u64,
) -> Result<String, GatewayError> {
    let now = crate::now_secs();

    let claims = Claims {
        sub: tenant_id,
        wallet: wallet.to_owned(),
        iat: now,
        exp: now + ttl_secs,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| GatewayError::Config(format!("jwt encode: {e}")))
}

pub fn verify(token: &str, secret: &str) -> Result<Claims, GatewayError> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| GatewayError::Unauthorized)?;

    Ok(data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issue_and_verify_roundtrip() {
        let id = Uuid::new_v4();
        let token = issue(id, "wallet_abc", "test-secret", 3600).unwrap();
        let claims = verify(&token, "test-secret").unwrap();
        assert_eq!(claims.sub, id);
        assert_eq!(claims.wallet, "wallet_abc");
    }

    #[test]
    fn verify_rejects_wrong_secret() {
        let id = Uuid::new_v4();
        let token = issue(id, "w", "secret-a", 3600).unwrap();
        assert!(verify(&token, "secret-b").is_err());
    }

    #[test]
    fn verify_rejects_garbage() {
        assert!(verify("not.a.jwt", "secret").is_err());
    }

    #[test]
    fn claims_have_valid_exp() {
        let id = Uuid::new_v4();
        let token = issue(id, "w", "s", 7200).unwrap();
        let claims = verify(&token, "s").unwrap();
        assert!(claims.exp > claims.iat);
        assert_eq!(claims.exp - claims.iat, 7200);
    }
}
