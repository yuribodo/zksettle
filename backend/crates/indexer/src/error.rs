use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use thiserror::Error;

#[derive(Debug, Error)]
#[non_exhaustive]
pub enum IndexerError {
    #[error("no log messages in transaction")]
    MissingEvents,

    #[error("no ProofSettled event found in logs")]
    NoProofSettledEvent,

    #[error("base64 decode failed: {0}")]
    Base64Decode(#[from] base64::DecodeError),

    #[error("borsh deserialization failed: {0}")]
    BorshDeserialize(String),

    #[error("event discriminator mismatch")]
    DiscriminatorMismatch,

    #[error("duplicate nullifier")]
    DuplicateNullifier,

    #[error("irys upload failed: {0}")]
    IrysUpload(String),

    #[error("dedup write failed: {0}")]
    DedupWrite(String),

    #[error("configuration error: {0}")]
    Config(String),

    #[error("unauthorized")]
    Unauthorized,
}

impl IntoResponse for IndexerError {
    fn into_response(self) -> Response {
        let status = match &self {
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Config(_) | Self::DedupWrite(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::IrysUpload(_) => StatusCode::BAD_GATEWAY,
            Self::Base64Decode(_)
            | Self::BorshDeserialize(_)
            | Self::DiscriminatorMismatch
            | Self::MissingEvents => StatusCode::BAD_REQUEST,
            Self::NoProofSettledEvent | Self::DuplicateNullifier => StatusCode::OK,
        };
        (status, self.to_string()).into_response()
    }
}
