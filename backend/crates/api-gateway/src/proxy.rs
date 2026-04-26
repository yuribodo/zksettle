use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};

use crate::auth::AuthenticatedKey;
use crate::error::GatewayError;
use crate::upstream::UpstreamRequest;
use crate::AppState;

const HOP_BY_HOP: &[&str] = &[
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "authorization",
];

fn is_hop_by_hop(name: &str) -> bool {
    HOP_BY_HOP.iter().any(|h| h.eq_ignore_ascii_case(name))
}

/// Route `/events*` (the indexer-served audit log) to `GATEWAY_INDEXER_URL`
/// when configured. Everything else goes to `GATEWAY_UPSTREAM_URL` (issuer-service).
fn pick_upstream<'a>(path_after_v1: &str, config: &'a crate::config::Config) -> &'a str {
    if path_after_v1.starts_with("/events") {
        if let Some(ref url) = config.indexer_url {
            return url.as_str();
        }
    }
    config.upstream_url.as_str()
}

fn filter_hop_by_hop(src: &HeaderMap) -> HeaderMap {
    let mut out = HeaderMap::with_capacity(src.len());
    for (name, value) in src.iter() {
        if !is_hop_by_hop(name.as_str()) {
            out.append(name.clone(), value.clone());
        }
    }
    out
}

#[mutants::skip]
pub async fn proxy_to_upstream(
    State(state): State<Arc<AppState>>,
    AuthenticatedKey(record): AuthenticatedKey,
    req: Request,
) -> Result<Response, GatewayError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let current = state.metering.current_count(&record.key_hash, now);
    if current >= record.tier.monthly_limit() {
        return Err(GatewayError::QuotaExhausted);
    }

    if !state.rate_limiter.check(&record.key_hash, record.tier) {
        return Err(GatewayError::RateLimited);
    }

    let method = req.method().clone();
    let req_headers = req.headers().clone();
    let raw_path = req.uri().path();
    let path = raw_path.strip_prefix("/v1").unwrap_or(raw_path);
    let query = req
        .uri()
        .query()
        .map(|q| format!("?{q}"))
        .unwrap_or_default();
    let upstream_base = pick_upstream(path, &state.config);
    let url = format!("{upstream_base}{path}{query}");

    let body_bytes = axum::body::to_bytes(req.into_body(), 1024 * 1024)
        .await
        .map_err(|e| GatewayError::Upstream(e.to_string()))?;

    let upstream_req = UpstreamRequest {
        method,
        url,
        headers: filter_hop_by_hop(&req_headers),
        body: body_bytes,
    };

    let upstream_resp = state.upstream.send(upstream_req).await?;

    if upstream_resp.status.is_success() || upstream_resp.status.is_redirection() {
        state.metering.increment(&record.key_hash, now);
    }

    let status = upstream_resp.status;
    let resp_headers = filter_hop_by_hop(&upstream_resp.headers);

    Ok((status, resp_headers, Body::from(upstream_resp.body)).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hop_by_hop_matches_all_entries() {
        for &h in HOP_BY_HOP {
            assert!(is_hop_by_hop(h), "{h} should be hop-by-hop");
        }
    }

    #[test]
    fn hop_by_hop_case_insensitive() {
        assert!(is_hop_by_hop("Connection"));
        assert!(is_hop_by_hop("TRANSFER-ENCODING"));
        assert!(is_hop_by_hop("Keep-Alive"));
    }

    #[test]
    fn not_hop_by_hop() {
        assert!(!is_hop_by_hop("content-type"));
        assert!(!is_hop_by_hop("accept"));
        assert!(!is_hop_by_hop("x-custom-header"));
    }

    #[test]
    fn filter_hop_by_hop_strips_hop_headers() {
        let mut src = HeaderMap::new();
        src.insert("connection", "keep-alive".parse().unwrap());
        src.insert("content-type", "application/json".parse().unwrap());
        src.insert("transfer-encoding", "chunked".parse().unwrap());
        src.insert("x-request-id", "abc".parse().unwrap());

        let filtered = filter_hop_by_hop(&src);

        assert!(!filtered.contains_key("connection"));
        assert!(!filtered.contains_key("transfer-encoding"));
        assert_eq!(filtered.get("content-type").unwrap(), "application/json");
        assert_eq!(filtered.get("x-request-id").unwrap(), "abc");
        assert_eq!(filtered.len(), 2);
    }

    fn cfg(upstream: &str, indexer: Option<&str>) -> crate::config::Config {
        crate::config::Config {
            port: 4000,
            upstream_url: upstream.into(),
            indexer_url: indexer.map(|s| s.into()),
            log_level: "error".into(),
            admin_key: None,
            allow_open_keys: true,
            cors_allowed_origins: vec![],
        }
    }

    #[test]
    fn pick_upstream_routes_events_to_indexer_when_configured() {
        let c = cfg("http://issuer:3000", Some("http://indexer:3001"));
        assert_eq!(pick_upstream("/events", &c), "http://indexer:3001");
        assert_eq!(pick_upstream("/events?limit=10", &c), "http://indexer:3001");
    }

    #[test]
    fn pick_upstream_falls_back_to_issuer_when_indexer_missing() {
        let c = cfg("http://issuer:3000", None);
        assert_eq!(pick_upstream("/events", &c), "http://issuer:3000");
    }

    #[test]
    fn pick_upstream_non_events_paths_go_to_issuer() {
        let c = cfg("http://issuer:3000", Some("http://indexer:3001"));
        assert_eq!(pick_upstream("/credentials/abc", &c), "http://issuer:3000");
        assert_eq!(pick_upstream("/roots", &c), "http://issuer:3000");
        assert_eq!(pick_upstream("/health", &c), "http://issuer:3000");
    }

    #[test]
    fn pick_upstream_only_matches_events_prefix() {
        let c = cfg("http://issuer:3000", Some("http://indexer:3001"));
        // A path that *contains* "events" but doesn't start with it should not route.
        assert_eq!(pick_upstream("/credentials_events", &c), "http://issuer:3000");
    }
}
