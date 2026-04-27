use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use sea_orm::DbErr;
use serde::Serialize;
use thiserror::Error;
use tracing::error;

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

    #[error("database error: {0}")]
    Database(String),
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
            Self::Config(_) | Self::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let message = match &self {
            Self::Database(detail) => {
                error!(error = %detail, "database error");
                "internal server error".to_owned()
            }
            Self::Config(detail) => {
                error!(error = %detail, "configuration error");
                "internal server error".to_owned()
            }
            other => other.to_string(),
        };
        let body = ErrorBody { error: message };
        (status, axum::Json(body)).into_response()
    }
}

impl From<DbErr> for GatewayError {
    fn from(err: DbErr) -> Self {
        Self::Database(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn database_error_returns_500() {
        let err = GatewayError::Database("connection refused".into());
        let resp = err.into_response();
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn db_err_converts_to_gateway_error() {
        let db_err = DbErr::Conn(sea_orm::RuntimeErr::Internal("fail".into()));
        let gw_err: GatewayError = db_err.into();
        assert!(matches!(gw_err, GatewayError::Database(_)));
    }
}
