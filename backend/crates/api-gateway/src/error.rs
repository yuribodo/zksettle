use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
#[non_exhaustive]
pub enum GatewayError {
    #[error("missing or invalid Authorization header")]
    Unauthorized,

    #[error("api key not found")]
    KeyNotFound,

    #[error("rate limit exceeded")]
    RateLimited,

    #[error("monthly quota exhausted")]
    QuotaExhausted,

    #[error("upstream request failed: {0}")]
    Upstream(String),

    #[error("forbidden")]
    Forbidden,

    #[error("not found")]
    NotFound,

    #[error("configuration error: {0}")]
    Config(String),
}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

impl IntoResponse for GatewayError {
    fn into_response(self) -> Response {
        let status = match &self {
            Self::Unauthorized | Self::KeyNotFound => StatusCode::UNAUTHORIZED,
            Self::RateLimited | Self::QuotaExhausted => StatusCode::TOO_MANY_REQUESTS,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Upstream(_) => StatusCode::BAD_GATEWAY,
            Self::Config(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let body = ErrorBody {
            error: self.to_string(),
        };
        (status, axum::Json(body)).into_response()
    }
}
