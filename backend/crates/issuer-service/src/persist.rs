use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::convert::bytes_be_to_fr;
use crate::error::ServiceError;
use crate::state::{CredentialRecord, IssuerState};

#[derive(Serialize, Deserialize)]
struct PersistedState {
    credentials: Vec<CredentialRecord>,
    registered: bool,
}

pub fn save(path: &str, state: &IssuerState) -> Result<(), ServiceError> {
    let mut creds: Vec<_> = state.credentials.values().cloned().collect();
    creds.sort_by_key(|c| c.leaf_index);

    let persisted = PersistedState {
        credentials: creds,
        registered: state.registered,
    };

    let json = serde_json::to_string_pretty(&persisted)
        .map_err(|e| ServiceError::Persist(e.to_string()))?;

    let tmp = format!("{path}.tmp");
    std::fs::write(&tmp, json.as_bytes())
        .map_err(|e| ServiceError::Persist(format!("write {tmp}: {e}")))?;
    std::fs::rename(&tmp, path)
        .map_err(|e| ServiceError::Persist(format!("rename {tmp} -> {path}: {e}")))?;

    Ok(())
}

pub fn load(path: &str) -> Result<IssuerState, ServiceError> {
    if !Path::new(path).exists() {
        return Err(ServiceError::Persist(format!("{path} not found")));
    }

    let data = std::fs::read_to_string(path)
        .map_err(|e| ServiceError::Persist(format!("read {path}: {e}")))?;
    let persisted: PersistedState = serde_json::from_str(&data)
        .map_err(|e| ServiceError::Persist(format!("parse {path}: {e}")))?;

    let mut state = IssuerState::new();
    state.registered = persisted.registered;

    let mut sorted = persisted.credentials;
    sorted.sort_by_key(|c| c.leaf_index);

    let mut credentials = HashMap::with_capacity(sorted.len());
    for cred in sorted {
        let fr = bytes_be_to_fr(&cred.wallet);
        state.membership_tree.insert(fr);
        credentials.insert(cred.wallet, cred);
    }
    state.credentials = credentials;

    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_save_load() {
        let dir = std::env::temp_dir().join("issuer_persist_test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("state.json");
        let path_str = path.to_str().unwrap();

        let mut state = IssuerState::new();
        state.registered = true;

        let wallet = [42u8; 32];
        let fr = bytes_be_to_fr(&wallet);
        state.membership_tree.insert(fr);
        state.credentials.insert(
            wallet,
            CredentialRecord {
                wallet,
                leaf_index: 0,
                jurisdiction: "US".into(),
                issued_at: 1000,
            },
        );

        save(path_str, &state).unwrap();
        let loaded = load(path_str).unwrap();

        assert_eq!(loaded.registered, true);
        assert_eq!(loaded.credentials.len(), 1);
        assert!(loaded.credentials.contains_key(&wallet));
        assert_eq!(
            crate::convert::fr_to_bytes_be(&loaded.membership_tree.root()),
            crate::convert::fr_to_bytes_be(&state.membership_tree.root()),
        );

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn load_missing_file_errors() {
        assert!(load("/tmp/does_not_exist_issuer.json").is_err());
    }
}
