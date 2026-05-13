use std::net::SocketAddr;
use std::path::PathBuf;

use zksettle_config::{env_or, expand_tilde};

pub struct Config {
    pub rpc_url: String,
    pub keypair_path: String,
    pub keypair_json: Option<String>,
    pub program_id: String,
    pub rotation_interval_secs: u64,
    pub listen_addr: SocketAddr,
    pub state_path: Option<String>,
    pub api_token: Option<String>,
    pub sunspot: Option<SunspotConfig>,
}

#[derive(Clone)]
pub struct SunspotConfig {
    pub bin: PathBuf,
    pub acir: PathBuf,
    pub ccs: PathBuf,
    pub pk: PathBuf,
    pub max_concurrency: usize,
    pub timeout_secs: u64,
    pub acir_sha256: String,
}

/// Pinned hash of `zksettle_slice.json` — must match the ACIR shipped with the
/// browser circuit at `frontend/public/circuits/zksettle_slice.json`. If the
/// circuit is recompiled, regenerate the artefacts and update this constant.
pub const DEFAULT_ACIR_SHA256: &str =
    "254f89c343dabea5dada8e0aaf10c2cfeafe1e7a764b5abae634b946d928d85f";

impl Config {
    pub fn from_env() -> Self {
        Self {
            rpc_url: env_or("RPC_URL", "http://127.0.0.1:8899"),
            keypair_path: expand_tilde(&env_or("KEYPAIR_PATH", "~/.config/solana/id.json")),
            keypair_json: std::env::var("ISSUER_KEYPAIR_JSON")
                .ok()
                .filter(|s| !s.trim().is_empty()),
            program_id: env_or("PROGRAM_ID", "zkSet11ezkSet11ezkSet11ezkSet11ezkSet11ezkS"),
            rotation_interval_secs: env_or("ROTATION_INTERVAL_SECS", "43200")
                .parse()
                .expect("ROTATION_INTERVAL_SECS must be u64"),
            listen_addr: env_or("LISTEN_ADDR", "127.0.0.1:3000")
                .parse()
                .expect("LISTEN_ADDR must be valid socket addr"),
            state_path: std::env::var("STATE_PATH").ok(),
            api_token: std::env::var("API_TOKEN").ok().filter(|s| !s.is_empty()),
            sunspot: SunspotConfig::from_env(),
        }
    }
}

impl SunspotConfig {
    fn from_env() -> Option<Self> {
        let bin = std::env::var("SUNSPOT_BIN").ok()?;
        let acir = std::env::var("SUNSPOT_ACIR_PATH").ok()?;
        let ccs = std::env::var("SUNSPOT_CCS_PATH").ok()?;
        let pk = std::env::var("SUNSPOT_PK_PATH").ok()?;

        let max_concurrency = std::env::var("SUNSPOT_MAX_CONCURRENCY")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(1usize)
            .max(1);
        let timeout_secs = std::env::var("SUNSPOT_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(120u64);
        let acir_sha256 = std::env::var("SUNSPOT_ACIR_SHA256")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_ACIR_SHA256.to_string());

        Some(Self {
            bin: PathBuf::from(expand_tilde(&bin)),
            acir: PathBuf::from(expand_tilde(&acir)),
            ccs: PathBuf::from(expand_tilde(&ccs)),
            pk: PathBuf::from(expand_tilde(&pk)),
            max_concurrency,
            timeout_secs,
            acir_sha256,
        })
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

    #[test]
    fn sunspot_none_when_unset() {
        let _lock = ENV_LOCK.lock().unwrap();
        for k in ["SUNSPOT_BIN", "SUNSPOT_ACIR_PATH", "SUNSPOT_CCS_PATH", "SUNSPOT_PK_PATH"] {
            std::env::remove_var(k);
        }
        assert!(SunspotConfig::from_env().is_none());
    }

    #[test]
    fn sunspot_some_when_all_set() {
        let _lock = ENV_LOCK.lock().unwrap();
        std::env::set_var("SUNSPOT_BIN", "/usr/bin/sunspot");
        std::env::set_var("SUNSPOT_ACIR_PATH", "/tmp/a.json");
        std::env::set_var("SUNSPOT_CCS_PATH", "/tmp/a.ccs");
        std::env::set_var("SUNSPOT_PK_PATH", "/tmp/a.pk");
        let sc = SunspotConfig::from_env().expect("all set");
        assert_eq!(sc.max_concurrency, 1);
        assert_eq!(sc.timeout_secs, 120);
        assert_eq!(sc.acir_sha256, DEFAULT_ACIR_SHA256);
        for k in ["SUNSPOT_BIN", "SUNSPOT_ACIR_PATH", "SUNSPOT_CCS_PATH", "SUNSPOT_PK_PATH"] {
            std::env::remove_var(k);
        }
    }
}
