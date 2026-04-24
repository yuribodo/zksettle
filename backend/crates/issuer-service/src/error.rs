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
