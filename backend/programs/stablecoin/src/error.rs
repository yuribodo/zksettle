use anchor_lang::prelude::*;

#[error_code]
pub enum StablecoinError {
    #[msg("Signer is not the treasury admin")]
    UnauthorizedAdmin,
    #[msg("Signer is not the treasury operator")]
    UnauthorizedOperator,
    #[msg("Signer does not own the token account")]
    UnauthorizedHolder,
    #[msg("Mint amount must be greater than zero")]
    ZeroMintAmount,
    #[msg("Burn amount must be greater than zero")]
    ZeroBurnAmount,
    #[msg("New admin must not be the default pubkey")]
    InvalidNewAdmin,
    #[msg("New operator must not be the default pubkey")]
    InvalidNewOperator,
    #[msg("Mint account does not match treasury")]
    MintMismatch,
    #[msg("Counter arithmetic overflow")]
    CounterOverflow,
    #[msg("Must provide at least one authority to transfer")]
    NoAuthorityChange,
    #[msg("Program is paused")]
    Paused,
    #[msg("Program is already in the requested pause state")]
    AlreadyInState,
}
