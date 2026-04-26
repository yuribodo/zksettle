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

/// Route `/events` and `/events/{id}` to `GATEWAY_INDEXER_URL` when configured.
/// Everything else goes to `GATEWAY_UPSTREAM_URL` (issuer-service).
fn pick_upstream<'a>(path_after_v1: &str, config: &'a crate::config::Config) -> &'a str {
    if path_after_v1 == "/events"
        || path_after_v1.starts_with("/events/")
        || path_after_v1.starts_with("/events?")
    {
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

    use axum::body::Body;
    use axum::http::{Method, StatusCode};
    use std::sync::Arc;
    use std::time::{SystemTime, UNIX_EPOCH};
    use zksettle_types::gateway::{ApiKeyRecord, Tier};

    use crate::config::Config;
    use crate::key_store::{hash_key, KeyStore};
    use crate::metering::Metering;
    use crate::rate_limit::RateLimitStore;
    use crate::upstream::{MockHttpUpstream, UpstreamResponse};

    fn record() -> ApiKeyRecord {
        ApiKeyRecord {
            key_hash: hash_key("zks_test"),
            tier: Tier::Developer,
            owner: "alice".into(),
            created_at: 0,
        }
    }

    fn state(mock: Arc<MockHttpUpstream>) -> Arc<AppState> {
        Arc::new(AppState {
            config: Config {
                port: 4000,
                upstream_url: "http://upstream.example".into(),
                log_level: "error".into(),
                admin_key: None,
                allow_open_keys: true,
                cors_allowed_origins: vec![],
                indexer_url: None,
            },
            keys: KeyStore::new(),
            metering: Metering::new(),
            rate_limiter: RateLimitStore::new(),
            upstream: mock,
        })
    }

    fn build_request() -> Request {
        Request::builder()
            .method(Method::GET)
            .uri("/v1/issuers/foo?x=1")
            .header("x-keep", "yes")
            .header("connection", "should-be-stripped")
            .body(Body::empty())
            .unwrap()
    }

    fn now_secs() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn happy_path_forwards_request_and_increments_metering() {
        let mock = Arc::new(MockHttpUpstream::new());
        let mut headers = HeaderMap::new();
        headers.insert("x-upstream", "value".parse().unwrap());
        mock.queue_response(UpstreamResponse {
            status: StatusCode::OK,
            headers,
            body: axum::body::Bytes::from_static(b"hello"),
        });
        let state = state(mock.clone());
        let rec = record();

        let resp = proxy_to_upstream(
            State(state.clone()),
            AuthenticatedKey(rec.clone()),
            build_request(),
        )
        .await
        .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        // handler uses SystemTime::now() internally; query with the same clock
        assert_eq!(state.metering.current_count(&rec.key_hash, now_secs()), 1);

        let sent = mock.last_sent().expect("mock recorded send");
        assert_eq!(sent.method, Method::GET);
        assert_eq!(sent.url, "http://upstream.example/issuers/foo?x=1");
        assert!(
            sent.headers.contains_key("x-keep"),
            "non-hop-by-hop headers must reach upstream"
        );
        assert!(
            !sent.headers.contains_key("connection"),
            "hop-by-hop headers must be stripped"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn upstream_5xx_is_propagated_and_metering_does_not_increment() {
        let mock = Arc::new(MockHttpUpstream::new());
        mock.queue_response(UpstreamResponse {
            status: StatusCode::BAD_GATEWAY,
            headers: HeaderMap::new(),
            body: axum::body::Bytes::new(),
        });
        let state = state(mock.clone());
        let rec = record();

        let resp = proxy_to_upstream(
            State(state.clone()),
            AuthenticatedKey(rec.clone()),
            build_request(),
        )
        .await
        .unwrap();

        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
        assert_eq!(
            state.metering.current_count(&rec.key_hash, now_secs()),
            0,
            "non-success upstream response must not consume quota"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn quota_exhausted_short_circuits_before_upstream_call() {
        let mock = Arc::new(MockHttpUpstream::new());
        let state = state(mock.clone());
        let rec = record();
        // pre-fill the metering counter with the same wall clock the handler
        // will read so the period-rollover branch doesn't reset us to zero
        let now = now_secs();
        for _ in 0..rec.tier.monthly_limit() {
            state.metering.increment(&rec.key_hash, now);
        }

        let err = proxy_to_upstream(State(state.clone()), AuthenticatedKey(rec), build_request())
            .await
            .unwrap_err();

        assert!(matches!(err, GatewayError::QuotaExhausted));
        assert_eq!(
            mock.sent_count(),
            0,
            "must not call upstream after quota check"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn upstream_transport_error_propagates_as_upstream_variant() {
        let mock = Arc::new(MockHttpUpstream::new());
        mock.queue_error(GatewayError::Upstream("network down".into()));
        let state = state(mock.clone());

        let err = proxy_to_upstream(
            State(state.clone()),
            AuthenticatedKey(record()),
            build_request(),
        )
        .await
        .unwrap_err();

        assert!(matches!(err, GatewayError::Upstream(_)));
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
        assert_eq!(pick_upstream("/credentials_events", &c), "http://issuer:3000");
    }

    #[test]
    fn pick_upstream_rejects_events_like_paths() {
        let c = cfg("http://issuer:3000", Some("http://indexer:3001"));
        assert_eq!(pick_upstream("/eventstream", &c), "http://issuer:3000");
        assert_eq!(pick_upstream("/events-foo", &c), "http://issuer:3000");
    }

    #[test]
    fn pick_upstream_routes_events_subpaths() {
        let c = cfg("http://issuer:3000", Some("http://indexer:3001"));
        assert_eq!(pick_upstream("/events/123", &c), "http://indexer:3001");
        assert_eq!(pick_upstream("/events/abc/detail", &c), "http://indexer:3001");
    }
}
