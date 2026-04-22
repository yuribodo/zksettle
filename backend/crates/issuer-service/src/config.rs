use std::net::SocketAddr;

pub struct Config {
    pub rpc_url: String,
    pub keypair_path: String,
    pub program_id: String,
    pub rotation_interval_secs: u64,
    pub listen_addr: SocketAddr,
    pub state_path: Option<String>,
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
            Err(_) => eprintln!("WARNING: path contains ~ but HOME is not set, using literal path: {path}"),
        }
    }
    path.to_string()
}
