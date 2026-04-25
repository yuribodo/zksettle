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

#[derive(Debug)]
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

    use zksettle_rpc::{MockSolanaRpc, RpcError};

    fn keypair_bytes() -> Vec<u8> {
        Keypair::new().to_bytes().to_vec()
    }

    /// Builds a 137-byte payload matching the on-chain Issuer PDA layout
    /// (8 disc + 32 authority + 32 merkle + 32 sanctions + 32 jurisdiction
    /// + 8 slot + 1 bump) used by `read_current_roots`.
    fn pda_payload(merkle: [u8; 32], sanctions: [u8; 32], jurisdiction: [u8; 32]) -> Vec<u8> {
        let mut buf = vec![0u8; 8 + 32]; // disc + authority padding
        buf.extend_from_slice(&merkle);
        buf.extend_from_slice(&sanctions);
        buf.extend_from_slice(&jurisdiction);
        buf.extend_from_slice(&[0u8; 8]); // slot
        buf.push(255); // bump
        buf
    }

    #[test]
    fn is_issuer_registered_returns_true_when_account_exists() {
        let rpc = MockSolanaRpc::new();
        let kp = Keypair::new();
        let program = Pubkey::new_unique();
        let (pda, _) = issuer_pda(&kp.pubkey(), &program);
        rpc.set_account(pda, vec![0u8; 137]);

        assert!(is_issuer_registered(&rpc, &kp.pubkey(), &program).unwrap());
    }

    #[test]
    fn is_issuer_registered_returns_false_when_account_missing() {
        let rpc = MockSolanaRpc::new();
        let kp = Keypair::new();
        let program = Pubkey::new_unique();
        assert!(!is_issuer_registered(&rpc, &kp.pubkey(), &program).unwrap());
    }

    #[test]
    fn read_current_roots_extracts_three_root_slices() {
        let rpc = MockSolanaRpc::new();
        let kp = Keypair::new();
        let program = Pubkey::new_unique();
        let (pda, _) = issuer_pda(&kp.pubkey(), &program);

        let merkle = [11u8; 32];
        let sanctions = [22u8; 32];
        let jurisdiction = [33u8; 32];
        rpc.set_account(pda, pda_payload(merkle, sanctions, jurisdiction));

        let (m, s, j) = read_current_roots(&rpc, &kp.pubkey(), &program).unwrap();
        assert_eq!(m, merkle);
        assert_eq!(s, sanctions);
        assert_eq!(j, jurisdiction);
    }

    #[test]
    fn read_current_roots_errors_when_pda_missing() {
        let rpc = MockSolanaRpc::new();
        let kp = Keypair::new();
        let err = read_current_roots(&rpc, &kp.pubkey(), &Pubkey::new_unique()).unwrap_err();
        assert!(matches!(err, UpdaterError::Chain(msg) if msg.contains("not found")));
    }

    #[test]
    fn read_current_roots_errors_when_data_too_short() {
        let rpc = MockSolanaRpc::new();
        let kp = Keypair::new();
        let program = Pubkey::new_unique();
        let (pda, _) = issuer_pda(&kp.pubkey(), &program);
        rpc.set_account(pda, vec![0u8; 64]); // need ≥136

        let err = read_current_roots(&rpc, &kp.pubkey(), &program).unwrap_err();
        assert!(matches!(err, UpdaterError::Chain(msg) if msg.contains("too short")));
    }

    #[test]
    fn publish_sanctions_root_first_call_uses_register_discriminator() {
        let rpc = MockSolanaRpc::new();
        let kb = keypair_bytes();
        let program = Pubkey::new_unique();

        let result = publish_sanctions_root(&rpc, &kb, &program, [9u8; 32], false).unwrap();

        assert!(result.did_register);
        assert_eq!(rpc.send_count(), 1);
        let sent = &rpc.sent_instructions()[0];
        assert_eq!(&sent.data[..8], &discriminator("register_issuer"));
    }

    #[test]
    fn publish_sanctions_root_when_registered_uses_update_discriminator() {
        let rpc = MockSolanaRpc::new();
        let kp = Keypair::from_bytes(&keypair_bytes()).unwrap();
        let program = Pubkey::new_unique();
        let (pda, _) = issuer_pda(&kp.pubkey(), &program);
        rpc.set_account(pda, pda_payload([1u8; 32], [2u8; 32], [3u8; 32]));

        let result = publish_sanctions_root(
            &rpc,
            &kp.to_bytes(),
            &program,
            [99u8; 32],
            true,
        )
        .unwrap();

        assert!(!result.did_register);
        assert_eq!(rpc.send_count(), 1);
        let sent = &rpc.sent_instructions()[0];
        assert_eq!(&sent.data[..8], &discriminator("update_issuer_root"));
        // body must carry the new sanctions root, not the old one
        assert!(sent.data.windows(32).any(|w| w == [99u8; 32]));
    }

    #[test]
    fn publish_sanctions_root_propagates_rpc_failure() {
        let rpc = MockSolanaRpc::new();
        rpc.queue_error(RpcError::Call("simulated".into()));

        let err = publish_sanctions_root(
            &rpc,
            &keypair_bytes(),
            &Pubkey::new_unique(),
            [0u8; 32],
            false,
        )
        .unwrap_err();
        assert!(matches!(err, UpdaterError::Chain(_)));
        assert_eq!(rpc.send_count(), 0);
    }
}
