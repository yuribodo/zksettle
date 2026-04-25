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

#[derive(Debug)]
pub struct UpstreamRequest {
    pub method: Method,
    pub url: String,
    pub headers: HeaderMap,
    pub body: Bytes,
}

#[derive(Debug)]
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

        const MAX_RESPONSE_BYTES: usize = 1024 * 1024;

        let content_length = resp
            .headers()
            .get(reqwest::header::CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<usize>().ok());

        if let Some(len) = content_length {
            if len > MAX_RESPONSE_BYTES {
                return Err(GatewayError::Upstream(format!(
                    "upstream response too large: {len} bytes"
                )));
            }
        }

        // reqwest and axum both re-export http 1.x HeaderMap; breaks if either bumps to http 2.x.
        let headers = resp.headers().clone();

        let body = resp
            .bytes()
            .await
            .map_err(|e| GatewayError::Upstream(e.to_string()))?;

        if body.len() > MAX_RESPONSE_BYTES {
            return Err(GatewayError::Upstream(format!(
                "upstream response too large: {} bytes",
                body.len()
            )));
        }

        Ok(UpstreamResponse {
            status,
            headers,
            body,
        })
    }
}

#[cfg(any(test, feature = "test-util"))]
pub mod mock {
    use std::collections::VecDeque;
    use std::sync::Mutex;

    use super::{HttpUpstream, UpstreamRequest, UpstreamResponse};
    use crate::error::GatewayError;
    use async_trait::async_trait;
    use axum::body::Bytes;
    use axum::http::{HeaderMap, StatusCode};

    /// In-memory `HttpUpstream` for tests. Holds a FIFO queue of canned
    /// responses; each `send` consumes one. Records every request for
    /// post-hoc assertions. `queue_error` injects a one-shot upstream
    /// failure to exercise error branches.
    pub struct MockHttpUpstream {
        responses: Mutex<VecDeque<UpstreamResponse>>,
        sent: Mutex<Vec<UpstreamRequest>>,
        pending_error: Mutex<Option<GatewayError>>,
    }

    impl MockHttpUpstream {
        pub fn new() -> Self {
            Self {
                responses: Mutex::new(VecDeque::new()),
                sent: Mutex::new(Vec::new()),
                pending_error: Mutex::new(None),
            }
        }

        /// Queue a response for the next `send` call. Calls drain in FIFO order.
        pub fn queue_response(&self, resp: UpstreamResponse) {
            self.responses.lock().unwrap().push_back(resp);
        }

        /// Convenience: queue a 200 OK with empty body.
        pub fn queue_ok(&self) {
            self.queue_response(UpstreamResponse {
                status: StatusCode::OK,
                headers: HeaderMap::new(),
                body: Bytes::new(),
            });
        }

        /// Cause the next `send` to fail with this error, then reset.
        pub fn queue_error(&self, error: GatewayError) {
            *self.pending_error.lock().unwrap() = Some(error);
        }

        pub fn sent_count(&self) -> usize {
            self.sent.lock().unwrap().len()
        }

        pub fn last_sent(&self) -> Option<UpstreamRequest> {
            self.sent.lock().unwrap().last().map(|r| UpstreamRequest {
                method: r.method.clone(),
                url: r.url.clone(),
                headers: r.headers.clone(),
                body: r.body.clone(),
            })
        }
    }

    impl Default for MockHttpUpstream {
        fn default() -> Self {
            Self::new()
        }
    }

    #[async_trait]
    impl HttpUpstream for MockHttpUpstream {
        async fn send(&self, req: UpstreamRequest) -> Result<UpstreamResponse, GatewayError> {
            if let Some(err) = self.pending_error.lock().unwrap().take() {
                return Err(err);
            }
            self.sent.lock().unwrap().push(req);
            self.responses.lock().unwrap().pop_front().ok_or_else(|| {
                GatewayError::Upstream("MockHttpUpstream: no queued response".into())
            })
        }
    }
}

#[cfg(any(test, feature = "test-util"))]
pub use mock::MockHttpUpstream;

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn mock_returns_queued_response_in_fifo_order() {
        let mock = MockHttpUpstream::new();
        mock.queue_response(UpstreamResponse {
            status: StatusCode::OK,
            headers: HeaderMap::new(),
            body: Bytes::from_static(b"first"),
        });
        mock.queue_response(UpstreamResponse {
            status: StatusCode::CREATED,
            headers: HeaderMap::new(),
            body: Bytes::from_static(b"second"),
        });

        let r1 = mock
            .send(UpstreamRequest {
                method: Method::GET,
                url: "http://x/1".into(),
                headers: HeaderMap::new(),
                body: Bytes::new(),
            })
            .await
            .unwrap();
        assert_eq!(r1.status, StatusCode::OK);
        assert_eq!(r1.body, Bytes::from_static(b"first"));

        let r2 = mock
            .send(UpstreamRequest {
                method: Method::POST,
                url: "http://x/2".into(),
                headers: HeaderMap::new(),
                body: Bytes::new(),
            })
            .await
            .unwrap();
        assert_eq!(r2.status, StatusCode::CREATED);

        assert_eq!(mock.sent_count(), 2);
    }

    #[tokio::test]
    async fn mock_send_errors_when_no_response_queued() {
        let mock = MockHttpUpstream::new();
        let err = mock
            .send(UpstreamRequest {
                method: Method::GET,
                url: "http://x".into(),
                headers: HeaderMap::new(),
                body: Bytes::new(),
            })
            .await
            .unwrap_err();
        assert!(matches!(err, GatewayError::Upstream(_)));
    }

    #[tokio::test]
    async fn queued_error_fires_once_and_does_not_record_send() {
        let mock = MockHttpUpstream::new();
        mock.queue_error(GatewayError::Upstream("boom".into()));
        mock.queue_ok();

        let err = mock
            .send(UpstreamRequest {
                method: Method::GET,
                url: "http://x".into(),
                headers: HeaderMap::new(),
                body: Bytes::new(),
            })
            .await
            .unwrap_err();
        assert!(matches!(err, GatewayError::Upstream(_)));
        assert_eq!(mock.sent_count(), 0, "errored send must not be recorded");

        // next call succeeds because the queued error was consumed
        mock.send(UpstreamRequest {
            method: Method::GET,
            url: "http://x".into(),
            headers: HeaderMap::new(),
            body: Bytes::new(),
        })
        .await
        .unwrap();
        assert_eq!(mock.sent_count(), 1);
    }
}
