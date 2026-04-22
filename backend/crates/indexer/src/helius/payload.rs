use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeliusTransaction {
    pub signature: String,
    pub slot: u64,
    pub timestamp: i64,
    #[serde(default)]
    pub log_messages: Vec<String>,
}
