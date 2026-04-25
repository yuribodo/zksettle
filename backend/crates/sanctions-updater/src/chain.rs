use borsh::BorshSerialize;
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::Signer;
use zksettle_rpc::SolanaRpc;

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

pub struct PublishResult {
    pub slot: u64,
    pub did_register: bool,
}

#[mutants::skip]
pub fn is_issuer_registered(
    rpc: &dyn SolanaRpc,
    authority: &Pubkey,
    program_id: &Pubkey,
) -> Result<bool, UpdaterError> {
    let (pda, _) = issuer_pda(authority, program_id);
    Ok(rpc.get_account_data(&pda)?.is_some())
}

// PDA layout: 8 disc + 32 authority + 32 merkle + 32 sanctions + 32 jurisdiction + 8 slot + 1 bump
#[mutants::skip]
pub fn read_current_roots(
    rpc: &dyn SolanaRpc,
    authority: &Pubkey,
    program_id: &Pubkey,
) -> Result<Roots, UpdaterError> {
    let (pda, _) = issuer_pda(authority, program_id);
    let data = rpc
        .get_account_data(&pda)?
        .ok_or_else(|| UpdaterError::Chain("issuer PDA not found".into()))?;

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

#[mutants::skip]
pub fn publish_sanctions_root(
    rpc: &dyn SolanaRpc,
    keypair_bytes: &[u8],
    program_id: &Pubkey,
    new_sanctions_root: [u8; 32],
    currently_registered: bool,
) -> Result<PublishResult, UpdaterError> {
    let keypair = Keypair::try_from(keypair_bytes)
        .map_err(|e| UpdaterError::Chain(e.to_string()))?;

    let (merkle_root, _old_sanctions, jurisdiction_root) = if currently_registered {
        read_current_roots(rpc, &keypair.pubkey(), program_id)?
    } else {
        ([0u8; 32], [0u8; 32], [0u8; 32])
    };

    let roots = RootArgs {
        merkle_root,
        sanctions_root: new_sanctions_root,
        jurisdiction_root,
    };

    let ix = build_ix(&keypair.pubkey(), program_id, &roots, !currently_registered);

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
        assert_ne!(issuer_pda(&a1, &program).0, issuer_pda(&a2, &program).0);
    }

    #[test]
    fn discriminator_known_value() {
        let disc = discriminator("register_issuer");
        assert_eq!(disc.len(), 8);
        assert_ne!(disc, [0u8; 8]);
    }

    #[test]
    fn discriminator_different_names_differ() {
        assert_ne!(discriminator("register_issuer"), discriminator("update_issuer_root"));
    }

    #[test]
    fn discriminator_matches_sha256_prefix() {
        use sha2::Digest;
        let hash = sha2::Sha256::digest(b"global:register_issuer");
        let expected: [u8; 8] = hash[..8].try_into().unwrap();
        assert_eq!(discriminator("register_issuer"), expected);
    }
}
