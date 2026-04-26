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

#[mutants::skip]
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

    /// Tests for the production `ReqwestUpstream` size guard. We can't use
    /// the mock here — the guard lives inside `ReqwestUpstream::send`. So we
    /// spin up a raw TCP server that emits hand-crafted HTTP/1.1 responses
    /// (no axum/hyper involved) and point reqwest at it. This lets us
    /// independently exercise:
    ///   - the `1024 * 1024` constant (line 60)
    ///   - the Content-Length guard (line 69)
    ///   - the body-length guard reached only when CL is absent (line 84)
    mod size_guard {
        use super::*;
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use tokio::net::TcpListener;

        const MAX_BYTES: usize = 1024 * 1024;

        /// Spin up a tokio TCP server that sends `response_bytes` verbatim
        /// for every accepted connection, then closes. Returns its port.
        async fn spawn_raw_server(response_bytes: Vec<u8>) -> u16 {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let port = listener.local_addr().unwrap().port();
            tokio::spawn(async move {
                loop {
                    let (mut sock, _) = match listener.accept().await {
                        Ok(s) => s,
                        Err(_) => return,
                    };
                    let bytes = response_bytes.clone();
                    tokio::spawn(async move {
                        // drain the request line + headers (best effort)
                        let mut buf = vec![0u8; 4096];
                        let _ = sock.read(&mut buf).await;
                        let _ = sock.write_all(&bytes).await;
                        let _ = sock.shutdown().await;
                    });
                }
            });
            port
        }

        fn req(port: u16) -> UpstreamRequest {
            UpstreamRequest {
                method: Method::GET,
                url: format!("http://127.0.0.1:{port}/"),
                headers: HeaderMap::new(),
                body: Bytes::new(),
            }
        }

        /// Body well above the `*→+` mutation's MAX (=2048) but well under
        /// the real MAX (=1MB) succeeds. Kills:
        ///   - line 60 `*` → `+` (mutated MAX=2048; 4KB rejected)
        ///   - line 60 `*` → `/` (mutated MAX=1; 4KB rejected)
        ///   - line 69 `>` → `<` (mutated: 4KB < 1MB true → reject)
        ///   - line 84 `>` → `<` (same logic on body.len())
        #[tokio::test]
        async fn under_limit_response_succeeds() {
            let body = vec![b'a'; 4096];
            let mut resp = format!(
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            )
            .into_bytes();
            resp.extend_from_slice(&body);
            let port = spawn_raw_server(resp).await;

            let upstream = ReqwestUpstream::new(Client::new());
            let result = upstream.send(req(port)).await.expect("must accept 4KB");
            assert_eq!(result.status, StatusCode::OK);
            assert_eq!(result.body.len(), 4096);
        }

        /// Content-Length header above MAX is rejected before reading the
        /// body. Kills:
        ///   - line 69 `>` → `==` (mutated: 2MB == 1MB false → no error)
        ///   - line 69 `>` → `<`  (mutated: 2MB < 1MB false → no error)
        #[tokio::test]
        async fn oversized_content_length_header_is_rejected() {
            // Lie about CL: claim 2MB, send empty body, close. Reqwest will
            // hand the headers to our code BEFORE attempting body read — our
            // line-69 guard fires immediately.
            let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 2097152\r\nConnection: close\r\n\r\n"
                .to_vec();
            let port = spawn_raw_server(resp).await;

            let upstream = ReqwestUpstream::new(Client::new());
            let err = upstream
                .send(req(port))
                .await
                .expect_err("oversized CL must be rejected");
            assert!(
                matches!(&err, GatewayError::Upstream(msg) if msg.contains("too large")),
                "unexpected error: {err:?}"
            );
        }

        /// Boundary case: body exactly at MAX must succeed. Kills:
        ///   - line 69 `>` → `>=` (mutated: 1MB >= 1MB true → reject)
        ///   - line 69 `>` → `==` (mutated: 1MB == 1MB true → reject)
        ///   - line 84 `>` → `>=` (same boundary on body.len())
        #[tokio::test]
        async fn exactly_max_size_response_succeeds() {
            let body = vec![0u8; MAX_BYTES];
            let mut resp = format!(
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                MAX_BYTES
            )
            .into_bytes();
            resp.extend_from_slice(&body);
            let port = spawn_raw_server(resp).await;

            let upstream = ReqwestUpstream::new(Client::new());
            let result = upstream
                .send(req(port))
                .await
                .expect("body exactly at MAX must pass");
            assert_eq!(result.body.len(), MAX_BYTES);
        }

        /// Without a Content-Length header, the line-69 guard cannot trip,
        /// so the line-84 body-length guard becomes the only defense. Kills:
        ///   - line 84 `>` → `==` (mutated: oversized != MAX → no error)
        ///   - line 84 `>` → `<`  (mutated: oversized < MAX false → no error)
        #[tokio::test]
        async fn oversized_body_without_content_length_is_rejected() {
            let body = vec![0u8; MAX_BYTES + 1];
            let mut resp = b"HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n".to_vec();
            resp.extend_from_slice(&body);
            let port = spawn_raw_server(resp).await;

            let upstream = ReqwestUpstream::new(Client::new());
            let err = upstream
                .send(req(port))
                .await
                .expect_err("oversized chunked-style body must be rejected");
            assert!(
                matches!(&err, GatewayError::Upstream(msg) if msg.contains("too large")),
                "unexpected error: {err:?}"
            );
        }
    }
}
