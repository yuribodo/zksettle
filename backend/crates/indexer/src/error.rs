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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;

    fn status_of(err: IndexerError) -> StatusCode {
        err.into_response().status()
    }

    #[test]
    fn status_codes() {
        assert_eq!(status_of(IndexerError::Unauthorized), StatusCode::UNAUTHORIZED);
        assert_eq!(status_of(IndexerError::Config("x".into())), StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(status_of(IndexerError::DedupWrite("x".into())), StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(status_of(IndexerError::IrysUpload("x".into())), StatusCode::BAD_GATEWAY);
        assert_eq!(status_of(IndexerError::MissingEvents), StatusCode::BAD_REQUEST);
        assert_eq!(status_of(IndexerError::BorshDeserialize("x".into())), StatusCode::BAD_REQUEST);
        assert_eq!(status_of(IndexerError::DiscriminatorMismatch), StatusCode::BAD_REQUEST);
        assert_eq!(status_of(IndexerError::NoProofSettledEvent), StatusCode::OK);
        assert_eq!(status_of(IndexerError::DuplicateNullifier), StatusCode::OK);
    }
}
