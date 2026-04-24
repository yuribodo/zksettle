use thiserror::Error;

#[derive(Debug, Error)]
pub enum UpdaterError {
    #[error("fetch error: {0}")]
    Fetch(String),

    #[error("parse error: {0}")]
    Parse(String),

    #[error("chain error: {0}")]
    Chain(String),

    #[error("crypto error: {0}")]
    Crypto(#[from] zksettle_crypto::error::CryptoError),

    #[error("invalid hex: {0}")]
    InvalidHex(String),
}

impl From<zksettle_rpc::RpcError> for UpdaterError {
    fn from(e: zksettle_rpc::RpcError) -> Self {
        UpdaterError::Chain(e.to_string())
    }
}
