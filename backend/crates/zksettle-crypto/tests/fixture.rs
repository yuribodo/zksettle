use ark_bn254::Fr;
use ark_ff::{AdditiveGroup, BigInteger, PrimeField};
use zksettle_crypto::{
    poseidon2_hash, verify_merkle_proof, verify_smt_exclusion, MerkleTree, SparseMerkleTree,
    MERKLE_DEPTH,
};

fn fr_to_hex(f: Fr) -> String {
    let repr = f.into_bigint();
    let bytes = repr.to_bytes_be();
    format!("0x{}", hex::encode(bytes))
}

fn parse_hex(s: &str) -> Fr {
    let s = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(s).unwrap();
    let mut be = [0u8; 32];
    be[32 - bytes.len()..].copy_from_slice(&bytes);
    Fr::from_be_bytes_mod_order(&be)
}

fn fr_from_u128(v: u128) -> Fr {
    use ark_ff::BigInt;
    let lo = v as u64;
    let hi = (v >> 64) as u64;
    Fr::from_bigint(BigInt::new([lo, hi, 0, 0])).unwrap()
}

fn wallet_key_bits(wallet: Fr) -> [u8; MERKLE_DEPTH] {
    let leaf_hash = poseidon2_hash(&[wallet]);
    let repr = leaf_hash.into_bigint();
    let le_bytes = repr.to_bytes_le();
    let mut bits = [0u8; MERKLE_DEPTH];
    for i in 0..MERKLE_DEPTH {
        bits[i] = (le_bytes[i / 8] >> (i % 8)) & 1;
    }
    bits
}

fn compute_merkle_root_from_path(
    leaf: Fr,
    siblings: &[Fr; MERKLE_DEPTH],
    path_indices: &[u8; MERKLE_DEPTH],
) -> Fr {
    let mut cur = leaf;
    for i in 0..MERKLE_DEPTH {
        let (l, r) = if path_indices[i] == 0 {
            (cur, siblings[i])
        } else {
            (siblings[i], cur)
        };
        cur = poseidon2_hash(&[l, r]);
    }
    cur
}

const EXPECTED_MERKLE_ROOT: &str =
    "0x0408f1aa9155d9f7405d652b9c5dd4cd69602fff5fba80e1d6bd0a36c3add6d1";
const EXPECTED_NULLIFIER: &str =
    "0x1d6ac8cee9f7b2d8f092a9169a9f49d81bb1ef665e21732414dcbe559ea0d560";
const EXPECTED_SANCTIONS_ROOT: &str =
    "0x03f5d399d3a5403fafb12fdab7483b3170812ee4e66e812bc8587e6921da2b4a";
const EXPECTED_JURISDICTION_ROOT: &str =
    "0x0408f1aa9155d9f7405d652b9c5dd4cd69602fff5fba80e1d6bd0a36c3add6d1";

#[test]
fn test_poseidon2_hash_known_vectors() {
    assert_eq!(
        fr_to_hex(poseidon2_hash(&[Fr::ZERO])),
        "0x2710144414c3a5f2354f4c08d52ed655b9fe253b4bf12cb9ad3de693d9b1db11",
        "hash([0]) mismatch vs zemse/poseidon2-evm"
    );
    assert_ne!(poseidon2_hash(&[Fr::from(1u64)]), Fr::ZERO);
}

#[test]
fn test_nullifier() {
    let private_key = Fr::from(42u64);
    let mint_lo = fr_from_u128(1334440654591915542993625911497130241u128);
    let mint_hi = fr_from_u128(1334440654591915542993625911497130241u128);
    let epoch = Fr::ZERO;
    let recipient_lo = fr_from_u128(2668881309183831085987251822994260482u128);
    let recipient_hi = fr_from_u128(2668881309183831085987251822994260482u128);
    let amount = Fr::from(1000u64);

    let nullifier = poseidon2_hash(&[
        private_key, mint_lo, mint_hi, epoch, recipient_lo, recipient_hi, amount,
    ]);

    assert_eq!(fr_to_hex(nullifier), fr_to_hex(parse_hex(EXPECTED_NULLIFIER)));
}

#[test]
fn test_merkle_root_single_leaf() {
    let wallet = Fr::from(1u64);
    let leaf = poseidon2_hash(&[wallet]);

    let mut tree = MerkleTree::new();
    tree.insert(leaf);

    assert_eq!(fr_to_hex(tree.root()), fr_to_hex(parse_hex(EXPECTED_MERKLE_ROOT)));
}

#[test]
fn test_merkle_proof_roundtrip() {
    let wallet = Fr::from(1u64);
    let leaf = poseidon2_hash(&[wallet]);

    let mut tree = MerkleTree::new();
    tree.insert(leaf);

    let proof = tree.proof(0).unwrap();
    assert!(verify_merkle_proof(leaf, &proof, tree.root()));
}

#[test]
fn test_sanctions_root_fixture() {
    let wallet = Fr::from(1u64);
    let key_bits = wallet_key_bits(wallet);
    let zero_siblings = [Fr::ZERO; MERKLE_DEPTH];

    let root = compute_merkle_root_from_path(Fr::ZERO, &zero_siblings, &key_bits);
    assert_eq!(fr_to_hex(root), fr_to_hex(parse_hex(EXPECTED_SANCTIONS_ROOT)));
}

#[test]
fn test_smt_exclusion_proof_roundtrip() {
    let smt = SparseMerkleTree::new();
    let wallet = Fr::from(1u64);

    let proof = smt.exclusion_proof(wallet).unwrap();
    assert_eq!(proof.leaf_value, Fr::ZERO);

    let root = smt.root();
    verify_smt_exclusion(wallet, &proof, root).unwrap();
}

#[test]
fn test_smt_sanctions_insert_blocks_exclusion() {
    let mut smt = SparseMerkleTree::new();
    let wallet = Fr::from(1u64);
    smt.insert(wallet);

    assert!(smt.exclusion_proof(wallet).is_err());
}

#[test]
fn test_jurisdiction_root() {
    let jurisdiction = Fr::from(1u64);
    let leaf = poseidon2_hash(&[jurisdiction]);

    let mut tree = MerkleTree::new();
    tree.insert(leaf);

    assert_eq!(fr_to_hex(tree.root()), fr_to_hex(parse_hex(EXPECTED_JURISDICTION_ROOT)));
}

#[test]
fn test_all_fixture_outputs() {
    let wallet = Fr::from(1u64);
    let membership_leaf = poseidon2_hash(&[wallet]);

    let mut membership_tree = MerkleTree::new();
    membership_tree.insert(membership_leaf);
    let merkle_root = membership_tree.root();

    let private_key = Fr::from(42u64);
    let mint_lo = fr_from_u128(1334440654591915542993625911497130241u128);
    let mint_hi = fr_from_u128(1334440654591915542993625911497130241u128);
    let epoch = Fr::ZERO;
    let recipient_lo = fr_from_u128(2668881309183831085987251822994260482u128);
    let recipient_hi = fr_from_u128(2668881309183831085987251822994260482u128);
    let amount = Fr::from(1000u64);
    let nullifier = poseidon2_hash(&[
        private_key, mint_lo, mint_hi, epoch, recipient_lo, recipient_hi, amount,
    ]);

    let key_bits = wallet_key_bits(wallet);
    let zero_siblings = [Fr::ZERO; MERKLE_DEPTH];
    let sanctions_root = compute_merkle_root_from_path(Fr::ZERO, &zero_siblings, &key_bits);

    let jurisdiction = Fr::from(1u64);
    let jurisdiction_leaf = poseidon2_hash(&[jurisdiction]);
    let mut jurisdiction_tree = MerkleTree::new();
    jurisdiction_tree.insert(jurisdiction_leaf);
    let jurisdiction_root = jurisdiction_tree.root();

    assert_eq!(fr_to_hex(merkle_root), fr_to_hex(parse_hex(EXPECTED_MERKLE_ROOT)));
    assert_eq!(fr_to_hex(nullifier), fr_to_hex(parse_hex(EXPECTED_NULLIFIER)));
    assert_eq!(fr_to_hex(sanctions_root), fr_to_hex(parse_hex(EXPECTED_SANCTIONS_ROOT)));
    assert_eq!(fr_to_hex(jurisdiction_root), fr_to_hex(parse_hex(EXPECTED_JURISDICTION_ROOT)));
}
