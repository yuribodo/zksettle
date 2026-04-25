use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("wallet not found")]
    WalletNotFound,

    #[error("wallet already registered")]
    DuplicateWallet,

    #[error("credential already revoked")]
    AlreadyRevoked,

    #[error("wallet credential has been revoked")]
    WalletRevoked,

    #[error("invalid hex: {0}")]
    InvalidHex(String),

    #[error("wallet is sanctioned")]
    WalletIsSanctioned,

    #[error("tree error: {0}")]
    Tree(zksettle_crypto::error::CryptoError),

    #[error("chain error: {0}")]
    Chain(String),

    #[error("persist error: {0}")]
    Persist(String),
}

impl From<zksettle_rpc::RpcError> for ServiceError {
    fn from(e: zksettle_rpc::RpcError) -> Self {
        ServiceError::Chain(e.to_string())
    }
}

impl From<zksettle_crypto::error::CryptoError> for ServiceError {
    fn from(e: zksettle_crypto::error::CryptoError) -> Self {
        match e {
            zksettle_crypto::error::CryptoError::WalletIsSanctioned => {
                ServiceError::WalletIsSanctioned
            }
            other => ServiceError::Tree(other),
        }
    }
}

impl IntoResponse for ServiceError {
    fn into_response(self) -> Response {
        let (status, msg) = match &self {
            ServiceError::WalletNotFound => (StatusCode::NOT_FOUND, self.to_string()),
            ServiceError::DuplicateWallet => (StatusCode::CONFLICT, self.to_string()),
            ServiceError::AlreadyRevoked => (StatusCode::CONFLICT, self.to_string()),
            ServiceError::WalletRevoked => (StatusCode::FORBIDDEN, self.to_string()),
            ServiceError::InvalidHex(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            ServiceError::WalletIsSanctioned => (StatusCode::FORBIDDEN, self.to_string()),
            ServiceError::Tree(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            ServiceError::Chain(_) => (StatusCode::BAD_GATEWAY, self.to_string()),
            ServiceError::Persist(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };
        let body = axum::Json(json!({ "error": msg }));
        (status, body).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;

    fn status_of(err: ServiceError) -> StatusCode {
        err.into_response().status()
    }

    #[test]
    fn status_codes() {
        assert_eq!(status_of(ServiceError::WalletNotFound), StatusCode::NOT_FOUND);
        assert_eq!(status_of(ServiceError::DuplicateWallet), StatusCode::CONFLICT);
        assert_eq!(status_of(ServiceError::AlreadyRevoked), StatusCode::CONFLICT);
        assert_eq!(status_of(ServiceError::WalletRevoked), StatusCode::FORBIDDEN);
        assert_eq!(status_of(ServiceError::InvalidHex("bad".into())), StatusCode::BAD_REQUEST);
        assert_eq!(status_of(ServiceError::WalletIsSanctioned), StatusCode::FORBIDDEN);
        assert_eq!(status_of(ServiceError::Chain("rpc fail".into())), StatusCode::BAD_GATEWAY);
        assert_eq!(status_of(ServiceError::Persist("io".into())), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn tree_error_maps_to_500() {
        use zksettle_crypto::error::CryptoError;
        let err = ServiceError::Tree(CryptoError::RootMismatch);
        assert_eq!(status_of(err), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn from_crypto_sanctioned() {
        use zksettle_crypto::error::CryptoError;
        let se: ServiceError = CryptoError::WalletIsSanctioned.into();
        assert!(matches!(se, ServiceError::WalletIsSanctioned));
    }

    #[test]
    fn from_crypto_other() {
        use zksettle_crypto::error::CryptoError;
        let se: ServiceError = CryptoError::RootMismatch.into();
        assert!(matches!(se, ServiceError::Tree(_)));
    }
}
