use crate::error::IndexerError;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub helius_auth_token: String,
    pub irys_node_url: String,
    pub irys_wallet_key: Option<String>,
    pub program_id: String,
    pub log_level: String,
}

impl Config {
    pub fn from_env() -> Result<Self, IndexerError> {
        Ok(Self {
            port: read_var("INDEXER_PORT")
                .unwrap_or_else(|_| "3000".into())
                .parse()
                .map_err(|_| IndexerError::Config("INDEXER_PORT must be a valid u16".into()))?,
            helius_auth_token: read_var("INDEXER_HELIUS_AUTH_TOKEN")?,
            irys_node_url: read_var("INDEXER_IRYS_NODE_URL")
                .unwrap_or_else(|_| "https://node2.irys.xyz".into()),
            irys_wallet_key: read_var("INDEXER_IRYS_WALLET_KEY").ok(),
            program_id: read_var("INDEXER_PROGRAM_ID")?,
            log_level: read_var("INDEXER_LOG_LEVEL").unwrap_or_else(|_| "info".into()),
        })
    }

    pub fn is_dry_run(&self) -> bool {
        self.irys_wallet_key.is_none()
    }
}

fn read_var(name: &str) -> Result<String, IndexerError> {
    std::env::var(name)
        .map_err(|_| IndexerError::Config(format!("missing required env var: {name}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_var_missing_reports_name() {
        let err = read_var("INDEXER_DOES_NOT_EXIST_TEST").unwrap_err();
        assert!(
            err.to_string().contains("INDEXER_DOES_NOT_EXIST_TEST"),
            "error should name the var"
        );
    }

    #[test]
    fn dry_run_when_no_wallet_key() {
        let cfg = Config {
            port: 3000,
            helius_auth_token: "tok".into(),
            irys_node_url: "http://localhost".into(),
            irys_wallet_key: None,
            program_id: "test".into(),
            log_level: "info".into(),
        };
        assert!(cfg.is_dry_run());
    }

    #[test]
    fn not_dry_run_when_wallet_key_present() {
        let cfg = Config {
            port: 3000,
            helius_auth_token: "tok".into(),
            irys_node_url: "http://localhost".into(),
            irys_wallet_key: Some("key".into()),
            program_id: "test".into(),
            log_level: "info".into(),
        };
        assert!(!cfg.is_dry_run());
    }
}
