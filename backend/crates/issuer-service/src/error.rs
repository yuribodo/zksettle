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

    #[error("invalid hex: {0}")]
    InvalidHex(String),

    #[error("tree error: {0}")]
    Tree(#[from] zksettle_crypto::error::CryptoError),

    #[error("chain error: {0}")]
    Chain(String),
}

impl IntoResponse for ServiceError {
    fn into_response(self) -> Response {
        let (status, msg) = match &self {
            ServiceError::WalletNotFound => (StatusCode::NOT_FOUND, self.to_string()),
            ServiceError::DuplicateWallet => (StatusCode::CONFLICT, self.to_string()),
            ServiceError::InvalidHex(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            ServiceError::Tree(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            ServiceError::Chain(_) => (StatusCode::BAD_GATEWAY, self.to_string()),
        };
        let body = axum::Json(json!({ "error": msg }));
        (status, body).into_response()
    }
}
