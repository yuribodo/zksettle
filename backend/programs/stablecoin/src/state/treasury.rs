use anchor_lang::prelude::*;

#[account]
pub struct Treasury {
    pub admin: Pubkey,
    pub operator: Pubkey,
    pub mint: Pubkey,
    pub mint_authority_bump: u8,
    pub freeze_authority_bump: u8,
    pub bump: u8,
    pub total_minted: u64,
    pub total_burned: u64,
    pub decimals: u8,
    pub paused: bool,
    pub pending_admin: Option<Pubkey>,
    pub mint_cap: u64,
}

impl Treasury {
    pub const LEN: usize = 32 + 32 + 32 + 1 + 1 + 1 + 8 + 8 + 1 + 1 + 33 + 8;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn treasury_len_matches_fields() {
        assert_eq!(
            Treasury::LEN,
            3 * std::mem::size_of::<Pubkey>() + 3 + 2 * std::mem::size_of::<u64>() + 2 + 33 + std::mem::size_of::<u64>(),
        );
    }
}
