pub fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

pub fn expand_tilde(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        match std::env::var("HOME") {
            Ok(home) => return format!("{home}/{rest}"),
            Err(_) => eprintln!(
                "WARNING: path contains ~ but HOME is not set, using literal path: {path}"
            ),
        }
    }
    path.to_string()
}

/// Load a Solana keypair JSON byte array either from the given env-var string
/// (when `Some`) or from `file_path` (when `None`). Panics with a descriptive
/// message on any parse or I/O failure.
///
/// `env_var_name` is used purely for log/panic messages so operators can tell
/// which env var was consulted.
pub fn load_keypair_json(
    env_keypair: Option<&str>,
    file_path: &str,
    env_var_name: &str,
) -> Vec<u8> {
    match env_keypair {
        Some(env_json) => {
            tracing::info!("loading keypair from {} env var", env_var_name);
            serde_json::from_str(env_json).unwrap_or_else(|e| {
                panic!(
                    "failed to parse {env_var_name} (expected JSON array like [1,2,3,...]): {e}"
                )
            })
        }
        None => {
            tracing::info!(path = %file_path, "loading keypair from file");
            let bytes = std::fs::read(file_path)
                .unwrap_or_else(|e| panic!("failed to read keypair at {file_path}: {e}"));
            serde_json::from_slice(&bytes)
                .unwrap_or_else(|e| panic!("failed to parse keypair JSON: {e}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_or_returns_default_when_var_unset() {
        // var name is deliberately unique so parallel tests can't collide
        let value = env_or("ZKSETTLE_CONFIG_ENV_OR_UNSET_TEST", "fallback");
        assert_eq!(value, "fallback");
    }

    #[test]
    fn expand_tilde_passes_through_non_tilde_paths() {
        assert_eq!(expand_tilde("/abs/path/key.json"), "/abs/path/key.json");
        assert_eq!(expand_tilde("relative/path"), "relative/path");
        assert_eq!(expand_tilde(""), "");
    }

    #[test]
    fn expand_tilde_expands_when_home_is_set() {
        if let Ok(home) = std::env::var("HOME") {
            let expanded = expand_tilde("~/foo/bar");
            assert_eq!(expanded, format!("{home}/foo/bar"));
        }
    }
}
