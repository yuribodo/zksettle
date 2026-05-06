use std::net::SocketAddr;

use zksettle_config::{env_or, expand_tilde};

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn empty_api_token_is_none() {
        let _lock = ENV_LOCK.lock().unwrap();
        std::env::set_var("API_TOKEN", "");
        let cfg = Config::from_env();
        assert!(cfg.api_token.is_none());
        std::env::remove_var("API_TOKEN");
    }

    #[test]
    fn nonempty_api_token_is_some() {
        let _lock = ENV_LOCK.lock().unwrap();
        std::env::set_var("API_TOKEN", "secret");
        let cfg = Config::from_env();
        assert_eq!(cfg.api_token.as_deref(), Some("secret"));
        std::env::remove_var("API_TOKEN");
    }
}
