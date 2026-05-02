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
}

impl Treasury {
    // admin (32) + operator (32) + mint (32)
    // + mint_authority_bump (1) + freeze_authority_bump (1) + bump (1)
    // + total_minted (8) + total_burned (8) + decimals (1)
    pub const LEN: usize = 32 + 32 + 32 + 1 + 1 + 1 + 8 + 8 + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn treasury_len_matches_fields() {
        assert_eq!(
            Treasury::LEN,
            3 * std::mem::size_of::<Pubkey>() + 3 + 2 * std::mem::size_of::<u64>() + 1,
        );
    }
}
