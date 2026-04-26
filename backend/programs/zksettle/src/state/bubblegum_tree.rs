use anchor_lang::prelude::*;

/// One-time registry: which concurrent merkle tree Bubblegum uses for compliance cNFTs.
#[account]
#[derive(InitSpace)]
pub struct BubblegumTreeRegistry {
    pub merkle_tree: Pubkey,
    pub tree_creator_bump: u8,
}
