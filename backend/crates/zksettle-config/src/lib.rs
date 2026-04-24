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
