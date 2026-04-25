use borsh::BorshSerialize;
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::Signer;
use zksettle_rpc::SolanaRpc;

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

pub struct PublishResult {
    pub slot: u64,
    pub did_register: bool,
}

#[mutants::skip]
pub fn is_issuer_registered(
    rpc: &dyn SolanaRpc,
    authority: &Pubkey,
    program_id: &Pubkey,
) -> Result<bool, ServiceError> {
    let (pda, _) = issuer_pda(authority, program_id);
    Ok(rpc.get_account_data(&pda)?.is_some())
}

#[mutants::skip]
pub fn publish_roots(
    rpc: &dyn SolanaRpc,
    keypair_bytes: &[u8],
    program_id: &Pubkey,
    merkle_root: [u8; 32],
    sanctions_root: [u8; 32],
    jurisdiction_root: [u8; 32],
    currently_registered: bool,
) -> Result<PublishResult, ServiceError> {
    let keypair = Keypair::try_from(keypair_bytes)
        .map_err(|e| ServiceError::Chain(e.to_string()))?;
    let roots = RootArgs { merkle_root, sanctions_root, jurisdiction_root };

    let ix = if !currently_registered {
        build_register_ix(&keypair.pubkey(), program_id, &roots)
    } else {
        build_update_ix(&keypair.pubkey(), program_id, &roots)
    };

    let (_sig, slot) = rpc.send_and_confirm(ix, &keypair)?;
    Ok(PublishResult {
        slot,
        did_register: !currently_registered,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn issuer_pda_deterministic() {
        let authority = Pubkey::from_str("11111111111111111111111111111112").unwrap();
        let program = Pubkey::from_str("11111111111111111111111111111113").unwrap();
        let (pda1, bump1) = issuer_pda(&authority, &program);
        let (pda2, bump2) = issuer_pda(&authority, &program);
        assert_eq!(pda1, pda2);
        assert_eq!(bump1, bump2);
    }

    #[test]
    fn issuer_pda_different_authorities_differ() {
        let a1 = Pubkey::from_str("11111111111111111111111111111112").unwrap();
        let a2 = Pubkey::from_str("11111111111111111111111111111114").unwrap();
        let program = Pubkey::from_str("11111111111111111111111111111113").unwrap();
        let (pda1, _) = issuer_pda(&a1, &program);
        let (pda2, _) = issuer_pda(&a2, &program);
        assert_ne!(pda1, pda2);
    }

    #[test]
    fn discriminator_known_value() {
        let disc = discriminator("register_issuer");
        assert_eq!(disc.len(), 8);
        assert_ne!(disc, [0u8; 8]);
    }

    #[test]
    fn discriminator_different_names_differ() {
        let d1 = discriminator("register_issuer");
        let d2 = discriminator("update_issuer_root");
        assert_ne!(d1, d2);
    }

    #[test]
    fn discriminator_matches_sha256_prefix() {
        use sha2::Digest;
        let hash = sha2::Sha256::digest(b"global:register_issuer");
        let expected: [u8; 8] = hash[..8].try_into().unwrap();
        assert_eq!(discriminator("register_issuer"), expected);
    }
}
