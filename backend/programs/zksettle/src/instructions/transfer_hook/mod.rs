mod handlers;
mod settlement;
#[cfg(test)]
mod tests;
mod types;

use anchor_lang::prelude::*;
use anchor_spl::token_interface;

use crate::error::ZkSettleError;
use crate::instructions::bubblegum_mint::{tree_config_pda, MPL_BUBBLEGUM_ID, NOOP_PROGRAM_ID};
use crate::state::{BubblegumTreeRegistry, Issuer, BUBBLEGUM_REGISTRY_SEED, BUBBLEGUM_TREE_CREATOR_SEED, ISSUER_SEED};

pub use handlers::{init_extra_account_meta_list_handler, set_hook_payload_handler};
pub use settlement::{execute_hook_handler, settle_hook_handler};
pub use types::{
    ExtraAccountMetaInput, HookPayload, StagedLightArgs, EXTRA_ACCOUNT_META_LIST_SEED,
    HOOK_PAYLOAD_SEED, MAX_HOOK_PROOF_BYTES,
};

#[derive(Accounts)]
#[instruction(
    proof_and_witness: Vec<u8>,
    nullifier_hash: [u8; 32],
    mint: Pubkey,
    epoch: u64,
    recipient: Pubkey,
    amount: u64,
    light_args: StagedLightArgs,
)]
pub struct SetHookPayload<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority @ ZkSettleError::UnauthorizedIssuer,
    )]
    pub issuer: Account<'info, Issuer>,

    // Seeded by `authority.key()` alone, not `nullifier_hash`: Token-2022's
    // Execute entry resolves the payload PDA from TLV `AddressConfig`, which
    // only sees `ExecuteInstruction` data (amount) and account keys —
    // nullifier-seeded PDAs are not addressable from the hook path. Trade-off:
    // one outstanding payload per authority, parallel hook transfers from the
    // same authority serialize on this PDA.
    #[account(
        init,
        payer = authority,
        space = 8 + HookPayload::INIT_SPACE,
        seeds = [HOOK_PAYLOAD_SEED, authority.key().as_ref()],
        bump,
    )]
    pub hook_payload: Account<'info, HookPayload>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(extras: Vec<ExtraAccountMetaInput>)]
pub struct InitExtraAccountMetaList<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority @ ZkSettleError::UnauthorizedIssuer,
    )]
    pub issuer: Account<'info, Issuer>,

    /// CHECK: validated by `validate_mint_has_hook()` at the start of the handler —
    /// unpacks as Token-2022 Mint and asserts the TransferHook extension points to
    /// this program. Kept as UncheckedAccount to avoid Anchor Mint deser overhead
    /// on a one-time setup instruction.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: allocated + populated by this handler via `system_program::create_account`
    /// and `ExtraAccountMetaList::init`. PDA seed matches the SPL transfer-hook
    /// interface convention so Token-2022 can resolve it.
    #[account(
        mut,
        seeds = [EXTRA_ACCOUNT_META_LIST_SEED, mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// Direct-call settlement: caller is the issuer authority, signs the tx, closes
/// the payload to themselves. Used by off-chain agents and tests; not routed
/// through Token-2022.
#[derive(Accounts)]
pub struct SettleHook<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(constraint = mint.key() == hook_payload.mint @ ZkSettleError::MintMismatch)]
    pub mint: InterfaceAccount<'info, token_interface::Mint>,
    /// CHECK: bound to `hook_payload.recipient` via constraint. Kept as
    /// UncheckedAccount because in the direct-call path `recipient` may be a
    /// wallet address (matching `leaf_owner`) rather than a token account.
    #[account(constraint = destination_token.key() == hook_payload.recipient @ ZkSettleError::RecipientMismatch)]
    pub destination_token: UncheckedAccount<'info>,

    #[account(
        mut,
        close = authority,
        seeds = [HOOK_PAYLOAD_SEED, authority.key().as_ref()],
        bump = hook_payload.bump,
    )]
    pub hook_payload: Account<'info, HookPayload>,

    /// CHECK: Bubblegum leaf owner; must match staged `recipient` in payload.
    #[account(address = hook_payload.recipient)]
    pub leaf_owner: UncheckedAccount<'info>,

    #[account(
        constraint = issuer.key() == hook_payload.issuer @ ZkSettleError::IssuerMismatch,
    )]
    pub issuer: Account<'info, Issuer>,

    #[account(seeds = [BUBBLEGUM_REGISTRY_SEED], bump)]
    pub registry: Account<'info, BubblegumTreeRegistry>,

    #[account(mut, address = registry.merkle_tree)]
    pub merkle_tree: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = tree_config.key() == tree_config_pda(&registry.merkle_tree).0 @ ZkSettleError::BubblegumCpiFailed
    )]
    pub tree_config: UncheckedAccount<'info>,

    #[account(
        seeds = [BUBBLEGUM_TREE_CREATOR_SEED],
        bump = registry.tree_creator_bump
    )]
    pub tree_creator: AccountInfo<'info>,

    #[account(address = MPL_BUBBLEGUM_ID)]
    pub bubblegum_program: UncheckedAccount<'info>,

    #[account(address = spl_account_compression::ID)]
    pub compression_program: UncheckedAccount<'info>,

    #[account(address = NOOP_PROGRAM_ID)]
    pub log_wrapper: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Token-2022 `Execute` entry. Account layout fixed by the hook interface:
/// positions 0..=3 are source-token / mint / destination-token / owner; the
/// remaining accounts are resolved from the TLV `extra_account_meta_list`.
///
/// `owner` is `UncheckedAccount` because Token-2022 passes the source-owner (or
/// delegate) as a non-signer read-only meta. Authority is enforced by the
/// `hook_payload` PDA seed `[HOOK_PAYLOAD_SEED, owner.key()]` — only the staging
/// signer that created the payload resolves the same PDA.
#[derive(Accounts)]
pub struct ExecuteHook<'info> {
    /// CHECK: source token account; Token-2022 enforces ownership + writability.
    pub source_token: UncheckedAccount<'info>,
    /// CHECK: mint; bound to `hook_payload.mint`.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: destination token; bound to `hook_payload.recipient`.
    pub destination_token: UncheckedAccount<'info>,
    /// CHECK: source owner or delegate; non-signer per hook interface. Bound to
    /// `hook_payload` via PDA seed.
    pub owner: UncheckedAccount<'info>,

    /// CHECK: TLV ExtraAccountMetaList validation state; Token-2022 checks PDA.
    #[account(
        seeds = [EXTRA_ACCOUNT_META_LIST_SEED, mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [HOOK_PAYLOAD_SEED, owner.key().as_ref()],
        bump = hook_payload.bump,
    )]
    pub hook_payload: Account<'info, HookPayload>,

    #[account(
        constraint = issuer.key() == hook_payload.issuer @ ZkSettleError::IssuerMismatch,
    )]
    pub issuer: Account<'info, Issuer>,

    #[account(seeds = [BUBBLEGUM_REGISTRY_SEED], bump)]
    pub registry: Account<'info, BubblegumTreeRegistry>,

    #[account(address = MPL_BUBBLEGUM_ID)]
    pub bubblegum_program: UncheckedAccount<'info>,
}
