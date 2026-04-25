use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("leaf index {index} out of bounds (tree has {size} leaves)")]
    IndexOutOfBounds { index: usize, size: usize },

    #[error("wallet is in the sanctions list")]
    WalletIsSanctioned,

    #[error("SMT path indices don't match wallet key bits")]
    InvalidSmtPathIndices,

    #[error("computed root doesn't match expected root")]
    RootMismatch,
}
