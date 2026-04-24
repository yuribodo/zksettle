use std::net::SocketAddr;

pub struct Config {
    pub rpc_url: String,
    pub keypair_path: String,
    pub program_id: String,
    pub rotation_interval_secs: u64,
    pub listen_addr: SocketAddr,
    pub state_path: Option<String>,
    pub api_token: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            rpc_url: env_or("RPC_URL", "http://127.0.0.1:8899"),
            keypair_path: expand_tilde(&env_or("KEYPAIR_PATH", "~/.config/solana/id.json")),
            program_id: env_or("PROGRAM_ID", "zkSet11ezkSet11ezkSet11ezkSet11ezkSet11ezkS"),
            rotation_interval_secs: env_or("ROTATION_INTERVAL_SECS", "43200")
                .parse()
                .expect("ROTATION_INTERVAL_SECS must be u64"),
            listen_addr: env_or("LISTEN_ADDR", "127.0.0.1:3000")
                .parse()
                .expect("LISTEN_ADDR must be valid socket addr"),
            state_path: std::env::var("STATE_PATH").ok(),
            api_token: std::env::var("API_TOKEN").ok().filter(|s| !s.is_empty()),
        }
    }
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn expand_tilde(path: &str) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_or_returns_default_when_var_unset() {
        // var name is deliberately unique so parallel tests can't collide
        let value = env_or("ISSUER_SERVICE_ENV_OR_UNSET_TEST", "fallback");
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
