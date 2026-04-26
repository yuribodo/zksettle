use crate::error::GatewayError;

#[derive(Clone)]
pub struct Config {
    pub port: u16,
    pub upstream_url: String,
    /// Optional secondary upstream for indexer-served paths (`/v1/events*`).
    /// When unset, those requests fall through to `upstream_url` (issuer-service).
    pub indexer_url: Option<String>,
    pub log_level: String,
    pub admin_key: Option<String>,
    pub allow_open_keys: bool,
    /// Origins allowed via CORS. Empty = CORS disabled (browser callers blocked).
    /// Set `GATEWAY_CORS_ALLOWED_ORIGINS=https://app.example.com,http://localhost:3000`.
    pub cors_allowed_origins: Vec<String>,
}

impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Config")
            .field("port", &self.port)
            .field("upstream_url", &self.upstream_url)
            .field("indexer_url", &self.indexer_url)
            .field("log_level", &self.log_level)
            .field("admin_key", &self.admin_key.as_ref().map(|_| "[REDACTED]"))
            .field("allow_open_keys", &self.allow_open_keys)
            .field("cors_allowed_origins", &self.cors_allowed_origins)
            .finish()
    }
}

impl Config {
    pub fn from_env() -> Result<Self, GatewayError> {
        Ok(Self {
            port: read_var("GATEWAY_PORT")
                .unwrap_or_else(|_| "4000".into())
                .parse()
                .map_err(|_| GatewayError::Config("GATEWAY_PORT must be a valid u16".into()))?,
            upstream_url: read_var("GATEWAY_UPSTREAM_URL")?,
            indexer_url: read_var("GATEWAY_INDEXER_URL").ok(),
            log_level: read_var("GATEWAY_LOG_LEVEL").unwrap_or_else(|_| "info".into()),
            admin_key: read_var("GATEWAY_ADMIN_KEY").ok(),
            allow_open_keys: read_var("GATEWAY_ALLOW_OPEN_KEYS")
                .map(|v| v.eq_ignore_ascii_case("true"))
                .unwrap_or(false),
            cors_allowed_origins: read_var("GATEWAY_CORS_ALLOWED_ORIGINS")
                .map(|v| parse_origins(&v))
                .unwrap_or_default(),
        })
    }
}

fn parse_origins(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn read_var(name: &str) -> Result<String, GatewayError> {
    std::env::var(name)
        .map_err(|_| GatewayError::Config(format!("missing required env var: {name}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_var_missing_reports_name() {
        let err = read_var("GATEWAY_DOES_NOT_EXIST_TEST").unwrap_err();
        assert!(
            err.to_string().contains("GATEWAY_DOES_NOT_EXIST_TEST"),
            "error should name the var"
        );
    }

    #[test]
    fn parse_origins_splits_and_trims() {
        assert_eq!(
            parse_origins("http://a.com, http://b.com"),
            vec!["http://a.com", "http://b.com"],
        );
    }

    #[test]
    fn parse_origins_drops_empty_segments() {
        assert_eq!(parse_origins("http://a.com,,http://b.com"), vec!["http://a.com", "http://b.com"]);
        assert!(parse_origins(",,,").is_empty());
        assert!(parse_origins("").is_empty());
    }

    #[test]
    fn debug_redacts_admin_key() {
        let cfg = Config {
            port: 4000,
            upstream_url: "http://localhost:3000".into(),
            log_level: "info".into(),
            admin_key: Some("my_admin_secret".into()),
            allow_open_keys: false,
            cors_allowed_origins: vec![],
            indexer_url: None,
        };
        let dbg = format!("{cfg:?}");
        assert!(!dbg.contains("my_admin_secret"));
        assert!(dbg.contains("[REDACTED]"));
    }
}
