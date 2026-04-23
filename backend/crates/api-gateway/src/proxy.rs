use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::{HeaderMap, HeaderName, StatusCode};
use axum::response::{IntoResponse, Response};

use crate::auth::AuthenticatedKey;
use crate::error::GatewayError;
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
    let path = req
        .uri()
        .path()
        .strip_prefix("/v1")
        .unwrap_or(req.uri().path());
    let query = req
        .uri()
        .query()
        .map(|q| format!("?{q}"))
        .unwrap_or_default();
    let url = format!("{}{path}{query}", state.config.upstream_url);

    let body_bytes = axum::body::to_bytes(req.into_body(), 1024 * 1024)
        .await
        .map_err(|e| GatewayError::Upstream(e.to_string()))?;

    let mut upstream_req = state.http.request(method, &url);
    for (name, value) in &req_headers {
        if !is_hop_by_hop(name.as_str()) {
            upstream_req = upstream_req.header(name.as_str(), value);
        }
    }

    let upstream_resp = upstream_req
        .body(body_bytes)
        .send()
        .await
        .map_err(|e| GatewayError::Upstream(e.to_string()))?;

    let status = StatusCode::from_u16(upstream_resp.status().as_u16())
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

    if status.is_success() || status.is_redirection() {
        state.metering.increment(&record.key_hash, now);
    }

    let mut resp_headers = HeaderMap::new();
    for (name, value) in upstream_resp.headers() {
        if !is_hop_by_hop(name.as_str()) {
            if let Ok(header_name) = HeaderName::from_bytes(name.as_str().as_bytes()) {
                resp_headers.append(header_name, value.clone());
            }
        }
    }

    let resp_bytes = upstream_resp
        .bytes()
        .await
        .map_err(|e| GatewayError::Upstream(e.to_string()))?;

    Ok((status, resp_headers, Body::from(resp_bytes)).into_response())
}
