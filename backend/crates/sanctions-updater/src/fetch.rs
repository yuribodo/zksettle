use crate::config::Config;
use crate::error::UpdaterError;

pub async fn fetch_sanctioned_wallets(config: &Config) -> Result<Vec<String>, UpdaterError> {
    if config.mock_sanctions {
        return Ok(mock_wallets());
    }
    fetch_ofac_wallets(&config.ofac_sdn_url).await
}

fn mock_wallets() -> Vec<String> {
    vec![
        "0x000000000000000000000000000000000000000000000000000000000000dead",
        "0x00000000000000000000000000000000000000000000000000000000cafebabe",
        "0x00000000000000000000000000000000000000000000000000000000deadbeef",
        "0x00000000000000000000000000000000000000000000000000000000bad00bad",
        "0x0000000000000000000000000000000000000000000000000000000000facade",
    ]
    .into_iter()
    .map(String::from)
    .collect()
}

async fn fetch_ofac_wallets(url: &str) -> Result<Vec<String>, UpdaterError> {
    let body = reqwest::get(url)
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
        // SDN CSV: look for "Digital Currency Address" entries
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_returns_wallets() {
        let wallets = mock_wallets();
        assert_eq!(wallets.len(), 5);
        for w in &wallets {
            assert!(w.starts_with("0x"));
        }
    }
}
