use borsh::BorshSerialize;
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::Signer;
use solana_sdk::transaction::Transaction;
use solana_rpc_client::rpc_client::RpcClient;

use crate::error::ServiceError;

const ISSUER_SEED: &[u8] = b"issuer";

fn issuer_pda(authority: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[ISSUER_SEED, authority.as_ref()], program_id)
}

#[derive(BorshSerialize)]
struct RootArgs {
    merkle_root: [u8; 32],
    sanctions_root: [u8; 32],
    jurisdiction_root: [u8; 32],
}

// Anchor discriminators: sha256("global:<fn_name>")[..8]
fn discriminator(name: &str) -> [u8; 8] {
    use std::io::Write;
    let input = format!("global:{name}");
    let hash = <sha2::Sha256 as sha2::Digest>::digest(input.as_bytes());
    let mut disc = [0u8; 8];
    (&mut disc[..]).write_all(&hash[..8]).unwrap();
    disc
}

fn build_register_ix(
    authority: &Pubkey,
    program_id: &Pubkey,
    roots: &RootArgs,
) -> Instruction {
    let (pda, _) = issuer_pda(authority, program_id);
    let disc = discriminator("register_issuer");
    let mut data = disc.to_vec();
    roots.serialize(&mut data).unwrap();

    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(pda, false),
            #[allow(deprecated)]
            AccountMeta::new_readonly(solana_sdk::system_program::ID, false),
        ],
        data,
    }
}

fn build_update_ix(
    authority: &Pubkey,
    program_id: &Pubkey,
    roots: &RootArgs,
) -> Instruction {
    let (pda, _) = issuer_pda(authority, program_id);
    let disc = discriminator("update_issuer_root");
    let mut data = disc.to_vec();
    roots.serialize(&mut data).unwrap();

    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new(pda, false),
        ],
        data,
    }
}

pub fn register_issuer(
    rpc: &RpcClient,
    keypair: &Keypair,
    program_id: &Pubkey,
    merkle_root: [u8; 32],
    sanctions_root: [u8; 32],
    jurisdiction_root: [u8; 32],
) -> Result<u64, ServiceError> {
    let roots = RootArgs { merkle_root, sanctions_root, jurisdiction_root };
    let ix = build_register_ix(&keypair.pubkey(), program_id, &roots);
    send_tx(rpc, keypair, ix)
}

pub fn update_issuer_root(
    rpc: &RpcClient,
    keypair: &Keypair,
    program_id: &Pubkey,
    merkle_root: [u8; 32],
    sanctions_root: [u8; 32],
    jurisdiction_root: [u8; 32],
) -> Result<u64, ServiceError> {
    let roots = RootArgs { merkle_root, sanctions_root, jurisdiction_root };
    let ix = build_update_ix(&keypair.pubkey(), program_id, &roots);
    send_tx(rpc, keypair, ix)
}

fn send_tx(
    rpc: &RpcClient,
    keypair: &Keypair,
    ix: Instruction,
) -> Result<u64, ServiceError> {
    let recent = rpc
        .get_latest_blockhash()
        .map_err(|e| ServiceError::Chain(e.to_string()))?;
    let tx = Transaction::new_signed_with_payer(&[ix], Some(&keypair.pubkey()), &[keypair], recent);
    let sig = rpc
        .send_and_confirm_transaction(&tx)
        .map_err(|e| ServiceError::Chain(e.to_string()))?;
    tracing::info!(%sig, "tx confirmed");
    let slot = rpc.get_slot().map_err(|e| ServiceError::Chain(e.to_string()))?;
    Ok(slot)
}
