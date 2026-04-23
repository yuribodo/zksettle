use borsh::BorshSerialize;
use solana_rpc_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::Signer;
use solana_sdk::transaction::Transaction;

use crate::error::UpdaterError;

type Roots = ([u8; 32], [u8; 32], [u8; 32]);

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

fn discriminator(name: &str) -> [u8; 8] {
    use std::io::Write;
    let input = format!("global:{name}");
    let hash = <sha2::Sha256 as sha2::Digest>::digest(input.as_bytes());
    let mut disc = [0u8; 8];
    (&mut disc[..]).write_all(&hash[..8]).unwrap();
    disc
}

fn build_ix(
    authority: &Pubkey,
    program_id: &Pubkey,
    roots: &RootArgs,
    register: bool,
) -> Instruction {
    let (pda, _) = issuer_pda(authority, program_id);
    let name = if register { "register_issuer" } else { "update_issuer_root" };
    let mut data = discriminator(name).to_vec();
    roots.serialize(&mut data).unwrap();

    let mut accounts = vec![
        if register {
            AccountMeta::new(*authority, true)
        } else {
            AccountMeta::new_readonly(*authority, true)
        },
        AccountMeta::new(pda, false),
    ];
    if register {
        #[allow(deprecated)]
        accounts.push(AccountMeta::new_readonly(solana_sdk::system_program::ID, false));
    }

    Instruction {
        program_id: *program_id,
        accounts,
        data,
    }
}

fn send_tx(
    rpc: &RpcClient,
    keypair: &Keypair,
    ix: Instruction,
) -> Result<u64, UpdaterError> {
    let recent = rpc
        .get_latest_blockhash()
        .map_err(|e| UpdaterError::Chain(e.to_string()))?;
    let tx = Transaction::new_signed_with_payer(&[ix], Some(&keypair.pubkey()), &[keypair], recent);
    let sig = rpc
        .send_and_confirm_transaction(&tx)
        .map_err(|e| UpdaterError::Chain(e.to_string()))?;
    tracing::info!(%sig, "tx confirmed");
    let statuses = rpc
        .get_signature_statuses(&[sig])
        .map_err(|e| UpdaterError::Chain(format!("get_signature_statuses: {e}")))?;
    let slot = statuses.value[0]
        .as_ref()
        .ok_or_else(|| UpdaterError::Chain("tx confirmed but status not found".into()))?
        .slot;
    Ok(slot)
}

pub struct PublishResult {
    pub slot: u64,
    pub did_register: bool,
}

pub fn is_issuer_registered(
    rpc_url: &str,
    authority: &Pubkey,
    program_id: &Pubkey,
) -> Result<bool, UpdaterError> {
    let rpc = RpcClient::new(rpc_url.to_string());
    let (pda, _) = issuer_pda(authority, program_id);
    let resp = rpc
        .get_account_with_commitment(&pda, CommitmentConfig::confirmed())
        .map_err(|e| UpdaterError::Chain(format!("RPC probe for issuer PDA failed: {e}")))?;
    Ok(resp.value.is_some())
}

// PDA layout: 8 disc + 32 authority + 32 merkle + 32 sanctions + 32 jurisdiction + 8 slot + 1 bump
pub fn read_current_roots(
    rpc_url: &str,
    authority: &Pubkey,
    program_id: &Pubkey,
) -> Result<Roots, UpdaterError> {
    let rpc = RpcClient::new(rpc_url.to_string());
    let (pda, _) = issuer_pda(authority, program_id);
    let account = rpc
        .get_account_with_commitment(&pda, CommitmentConfig::confirmed())
        .map_err(|e| UpdaterError::Chain(e.to_string()))?
        .value
        .ok_or_else(|| UpdaterError::Chain("issuer PDA not found".into()))?;

    let data = &account.data;
    if data.len() < 8 + 32 + 32 * 3 {
        return Err(UpdaterError::Chain(format!(
            "PDA data too short: {} bytes",
            data.len()
        )));
    }

    let mut merkle = [0u8; 32];
    let mut sanctions = [0u8; 32];
    let mut jurisdiction = [0u8; 32];
    merkle.copy_from_slice(&data[40..72]);
    sanctions.copy_from_slice(&data[72..104]);
    jurisdiction.copy_from_slice(&data[104..136]);

    Ok((merkle, sanctions, jurisdiction))
}

pub fn publish_sanctions_root(
    rpc_url: &str,
    keypair_bytes: &[u8],
    program_id: &Pubkey,
    new_sanctions_root: [u8; 32],
    currently_registered: bool,
) -> Result<PublishResult, UpdaterError> {
    let keypair = Keypair::try_from(keypair_bytes)
        .map_err(|e| UpdaterError::Chain(e.to_string()))?;

    let (merkle_root, _old_sanctions, jurisdiction_root) = if currently_registered {
        read_current_roots(rpc_url, &keypair.pubkey(), program_id)?
    } else {
        ([0u8; 32], [0u8; 32], [0u8; 32])
    };

    let rpc = RpcClient::new(rpc_url.to_string());
    let roots = RootArgs {
        merkle_root,
        sanctions_root: new_sanctions_root,
        jurisdiction_root,
    };

    let ix = build_ix(&keypair.pubkey(), program_id, &roots, !currently_registered);

    let slot = send_tx(&rpc, &keypair, ix)?;
    Ok(PublishResult {
        slot,
        did_register: !currently_registered,
    })
}
