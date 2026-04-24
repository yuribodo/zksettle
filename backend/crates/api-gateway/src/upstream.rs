//! Abstraction over the outbound HTTP leg of the proxy path.
//!
//! `proxy_to_upstream` builds an `UpstreamRequest`, calls
//! `HttpUpstream::send`, and shapes the response. Production wires
//! `ReqwestUpstream`; tests wire canned responses.

use async_trait::async_trait;
use axum::body::Bytes;
use axum::http::{HeaderMap, Method, StatusCode};
use reqwest::Client;

use crate::error::GatewayError;

pub struct UpstreamRequest {
    pub method: Method,
    pub url: String,
    pub headers: HeaderMap,
    pub body: Bytes,
}

pub struct UpstreamResponse {
    pub status: StatusCode,
    pub headers: HeaderMap,
    pub body: Bytes,
}

#[async_trait]
pub trait HttpUpstream: Send + Sync {
    async fn send(&self, req: UpstreamRequest) -> Result<UpstreamResponse, GatewayError>;
}

pub struct ReqwestUpstream {
    client: Client,
}

impl ReqwestUpstream {
    pub fn new(client: Client) -> Self {
        Self { client }
    }
}

#[async_trait]
impl HttpUpstream for ReqwestUpstream {
    async fn send(&self, req: UpstreamRequest) -> Result<UpstreamResponse, GatewayError> {
        let mut builder = self.client.request(req.method, &req.url);
        for (name, value) in req.headers.iter() {
            builder = builder.header(name, value);
        }
        let resp = builder
            .body(req.body)
            .send()
            .await
            .map_err(|e| GatewayError::Upstream(e.to_string()))?;

        let status = StatusCode::from_u16(resp.status().as_u16())
            .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        // reqwest and axum both re-export http 1.x HeaderMap; breaks if either bumps to http 2.x.
        let headers = resp.headers().clone();
        let body = resp
            .bytes()
            .await
            .map_err(|e| GatewayError::Upstream(e.to_string()))?;

        Ok(UpstreamResponse { status, headers, body })
    }
}
