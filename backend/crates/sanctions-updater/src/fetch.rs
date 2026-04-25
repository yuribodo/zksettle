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

#[async_trait]
impl OfacFetcher for HttpOfacFetcher {
    async fn fetch_wallets(&self) -> Result<Vec<String>, UpdaterError> {
        let body = reqwest::get(&self.url)
            .await
            .map_err(|e| UpdaterError::Fetch(e.to_string()))?
            .text()
            .await
            .map_err(|e| UpdaterError::Fetch(e.to_string()))?;

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
}
