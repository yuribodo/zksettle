use zksettle_crypto::smt::SparseMerkleTree;

use crate::convert::{fr_to_bytes_be, wallet_to_fr};
use crate::error::UpdaterError;

pub fn build_sanctions_tree(
    wallets: &[String],
) -> Result<(SparseMerkleTree, [u8; 32]), UpdaterError> {
    let mut tree = SparseMerkleTree::new();
    for w in wallets {
        let fr = wallet_to_fr(w)?;
        tree.insert(fr);
    }
    let root_bytes = fr_to_bytes_be(&tree.root());
    tracing::info!(wallets = wallets.len(), root = hex::encode(root_bytes), "built sanctions tree");
    Ok((tree, root_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_tree_from_mock_wallets() {
        let wallets: Vec<String> = vec![
            "0x000000000000000000000000000000000000000000000000000000000000dead",
            "0x00000000000000000000000000000000000000000000000000000000cafebabe",
        ]
        .into_iter()
        .map(String::from)
        .collect();

        let (_, root) = build_sanctions_tree(&wallets).unwrap();
        assert_ne!(root, [0u8; 32]);
    }

    #[test]
    fn empty_tree_has_deterministic_root() {
        let (_, root1) = build_sanctions_tree(&[]).unwrap();
        let (_, root2) = build_sanctions_tree(&[]).unwrap();
        assert_eq!(root1, root2);
    }
}
