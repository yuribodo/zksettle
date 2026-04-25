use crate::error::GatewayError;

#[derive(Clone)]
pub struct Config {
    pub port: u16,
    pub upstream_url: String,
    pub log_level: String,
    pub admin_key: Option<String>,
    pub allow_open_keys: bool,
}

impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Config")
            .field("port", &self.port)
            .field("upstream_url", &self.upstream_url)
            .field("log_level", &self.log_level)
            .field("admin_key", &self.admin_key.as_ref().map(|_| "[REDACTED]"))
            .field("allow_open_keys", &self.allow_open_keys)
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
            log_level: read_var("GATEWAY_LOG_LEVEL").unwrap_or_else(|_| "info".into()),
            admin_key: read_var("GATEWAY_ADMIN_KEY").ok(),
            allow_open_keys: read_var("GATEWAY_ALLOW_OPEN_KEYS")
                .map(|v| v.eq_ignore_ascii_case("true"))
                .unwrap_or(false),
        })
    }
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
    fn debug_redacts_admin_key() {
        let cfg = Config {
            port: 4000,
            upstream_url: "http://localhost:3000".into(),
            log_level: "info".into(),
            admin_key: Some("my_admin_secret".into()),
            allow_open_keys: false,
        };
        let dbg = format!("{cfg:?}");
        assert!(!dbg.contains("my_admin_secret"));
        assert!(dbg.contains("[REDACTED]"));
    }
}
