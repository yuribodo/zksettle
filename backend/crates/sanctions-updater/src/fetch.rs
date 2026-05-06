use async_trait::async_trait;

use crate::error::UpdaterError;

#[async_trait]
pub trait OfacFetcher: Send + Sync {
    async fn fetch_wallets(&self) -> Result<Vec<String>, UpdaterError>;
}

pub struct HttpOfacFetcher {
    url: String,
}

impl HttpOfacFetcher {
    pub fn new(url: impl Into<String>) -> Self {
        Self { url: url.into() }
    }
}

fn parse_wallets_from_csv(body: &str) -> Result<Vec<String>, UpdaterError> {
    let mut wallets = Vec::new();
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(body.as_bytes());

    for result in rdr.records() {
        let record = result.map_err(|e| UpdaterError::Parse(e.to_string()))?;
        for field in record.iter() {
            let trimmed = field.trim();
            if trimmed.starts_with("0x") && trimmed.len() == 66 {
                wallets.push(trimmed.to_string());
            }
        }
    }

    Ok(wallets)
}

#[async_trait]
impl OfacFetcher for HttpOfacFetcher {
    #[mutants::skip]
    async fn fetch_wallets(&self) -> Result<Vec<String>, UpdaterError> {
        let body = reqwest::get(&self.url)
            .await
            .map_err(|e| UpdaterError::Fetch(e.to_string()))?
            .text()
            .await
            .map_err(|e| UpdaterError::Fetch(e.to_string()))?;

        let wallets = parse_wallets_from_csv(&body)?;
        tracing::info!(count = wallets.len(), "fetched OFAC wallet addresses");
        Ok(wallets)
    }
}

pub struct MockOfacFetcher {
    wallets: Vec<String>,
}

impl MockOfacFetcher {
    pub fn new(wallets: Vec<String>) -> Self {
        Self { wallets }
    }

    pub fn with_default_fixture() -> Self {
        let wallets = [
            "0x000000000000000000000000000000000000000000000000000000000000dead",
            "0x00000000000000000000000000000000000000000000000000000000cafebabe",
            "0x00000000000000000000000000000000000000000000000000000000deadbeef",
            "0x00000000000000000000000000000000000000000000000000000000bad00bad",
            "0x0000000000000000000000000000000000000000000000000000000000facade",
        ]
        .into_iter()
        .map(String::from)
        .collect();
        Self::new(wallets)
    }
}

#[async_trait]
impl OfacFetcher for MockOfacFetcher {
    async fn fetch_wallets(&self) -> Result<Vec<String>, UpdaterError> {
        Ok(self.wallets.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn default_fixture_returns_five_wallets() {
        let fetcher = MockOfacFetcher::with_default_fixture();
        let wallets = fetcher.fetch_wallets().await.unwrap();
        assert_eq!(wallets.len(), 5);
        assert!(wallets.iter().all(|w| w.starts_with("0x") && w.len() == 66));
    }

    #[tokio::test]
    async fn mock_returns_provided_list() {
        let fetcher = MockOfacFetcher::new(vec!["0xabc".into(), "0xdef".into()]);
        assert_eq!(fetcher.fetch_wallets().await.unwrap(), vec!["0xabc", "0xdef"]);
    }

    #[test]
    fn parse_extracts_valid_wallets() {
        let csv = "id,name,address\n1,Alice,0x000000000000000000000000000000000000000000000000000000000000dead\n2,Bob,not-a-wallet\n";
        let wallets = parse_wallets_from_csv(csv).unwrap();
        assert_eq!(wallets, vec!["0x000000000000000000000000000000000000000000000000000000000000dead"]);
    }

    #[test]
    fn parse_empty_csv_returns_empty() {
        let wallets = parse_wallets_from_csv("").unwrap();
        assert!(wallets.is_empty());
    }

    #[test]
    fn parse_rejects_short_hex() {
        let csv = "0xdead\n";
        let wallets = parse_wallets_from_csv(csv).unwrap();
        assert!(wallets.is_empty());
    }

    #[test]
    fn parse_rejects_non_0x_prefix() {
        let addr = "1x000000000000000000000000000000000000000000000000000000000000dead";
        assert_eq!(addr.len(), 66);
        let csv = format!("{addr}\n");
        let wallets = parse_wallets_from_csv(&csv).unwrap();
        assert!(wallets.is_empty());
    }

    #[test]
    fn parse_multiple_fields_per_row() {
        let a = "0x000000000000000000000000000000000000000000000000000000000000aaaa";
        let b = "0x000000000000000000000000000000000000000000000000000000000000bbbb";
        let csv = format!("{a},{b}\n");
        let wallets = parse_wallets_from_csv(&csv).unwrap();
        assert_eq!(wallets.len(), 2);
    }
}
