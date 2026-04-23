pub struct Config {
    pub rpc_url: String,
    pub keypair_path: String,
    pub program_id: String,
    pub update_interval_secs: u64,
    pub mock_sanctions: bool,
    pub ofac_sdn_url: String,
    pub log_level: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            rpc_url: env_or("RPC_URL", "http://127.0.0.1:8899"),
            keypair_path: expand_tilde(&env_or("KEYPAIR_PATH", "~/.config/solana/id.json")),
            program_id: env_or("PROGRAM_ID", "zkSet11ezkSet11ezkSet11ezkSet11ezkSet11ezkS"),
            update_interval_secs: env_or("UPDATE_INTERVAL_SECS", "86400")
                .parse()
                .expect("UPDATE_INTERVAL_SECS must be u64"),
            mock_sanctions: env_or("MOCK_SANCTIONS", "true")
                .parse()
                .expect("MOCK_SANCTIONS must be bool"),
            ofac_sdn_url: env_or(
                "OFAC_SDN_URL",
                "https://www.treasury.gov/ofac/downloads/sdn.csv",
            ),
            log_level: env_or("LOG_LEVEL", "info"),
        }
    }
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn expand_tilde(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{home}/{rest}");
        }
    }
    path.to_string()
}
