use axum::extract::{FromRequestParts, Path, Request};
use axum::http::StatusCode;
use axum::http::request::Parts;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Extension;
use serde_json::json;
use sha2::{Sha256, Digest};
use std::collections::HashMap;
use subtle::ConstantTimeEq;

use std::str::FromStr;

use crate::error::ServiceError;

#[derive(Clone, Copy)]
pub struct AllowUnauthenticated(pub bool);

#[derive(Clone)]
pub struct ApiToken(String);

impl ApiToken {
    pub fn new(s: String) -> Self {
        Self(s)
    }

    pub fn as_bytes(&self) -> &[u8] {
        self.0.as_bytes()
    }
}

impl std::fmt::Debug for ApiToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("ApiToken(***)")
    }
}

pub async fn require_bearer(
    Extension(token): Extension<ApiToken>,
    req: Request,
    next: Next,
) -> Response {
    let bearer = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("");

    let input_hash = Sha256::digest(bearer.as_bytes());
    let token_hash = Sha256::digest(token.as_bytes());
    let authorized: bool = input_hash.ct_eq(&token_hash).into();

    if !authorized {
        let body = axum::Json(json!({ "error": "unauthorized" }));
        return (StatusCode::UNAUTHORIZED, body).into_response();
    }

    next.run(req).await
}

pub struct WalletAuth {
    pub wallet_hex: String,
    pub wallet_bytes: [u8; 32],
}

const REPLAY_WINDOW_SECS: u64 = 300;

impl<S: Send + Sync> FromRequestParts<S> for WalletAuth {
    type Rejection = ServiceError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let params = Path::<HashMap<String, String>>::from_request_parts(parts, state)
            .await
            .map_err(|_| ServiceError::InvalidHex("missing wallet path parameter".into()))?;

        let wallet_hex = params
            .get("wallet")
            .ok_or_else(|| ServiceError::InvalidHex("missing wallet path parameter".into()))?
            .to_ascii_lowercase();

        let stripped = wallet_hex.strip_prefix("0x").unwrap_or(&wallet_hex);
        let wallet_bytes: [u8; 32] = hex::decode(stripped)
            .map_err(|e| ServiceError::InvalidHex(e.to_string()))
            .and_then(|b| {
                b.try_into()
                    .map_err(|_| ServiceError::InvalidHex("expected 32 bytes".into()))
            })?;

        let allow_unauth = parts
            .extensions
            .get::<AllowUnauthenticated>()
            .map(|a| a.0)
            .unwrap_or(false);

        if allow_unauth {
            return Ok(WalletAuth {
                wallet_hex,
                wallet_bytes,
            });
        }

        let sig_header = parts
            .headers
            .get("x-wallet-signature")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| {
                ServiceError::Unauthorized("missing X-Wallet-Signature header".into())
            })?;

        let ts_header = parts
            .headers
            .get("x-wallet-timestamp")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| {
                ServiceError::Unauthorized("missing X-Wallet-Timestamp header".into())
            })?;

        let timestamp: u64 = ts_header
            .parse()
            .map_err(|_| ServiceError::Unauthorized("invalid timestamp".into()))?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if now.abs_diff(timestamp) > REPLAY_WINDOW_SECS {
            return Err(ServiceError::Unauthorized("timestamp outside replay window".into()));
        }

        let message = format!("zksettle:{wallet_hex}:{timestamp}");

        let sig = solana_sdk::signature::Signature::from_str(sig_header).map_err(|_| {
            ServiceError::Unauthorized("malformed signature".into())
        })?;

        let pubkey =
            solana_sdk::pubkey::Pubkey::try_from(wallet_bytes.as_slice()).map_err(|_| {
                ServiceError::Unauthorized("invalid pubkey".into())
            })?;

        if !sig.verify(pubkey.as_ref(), message.as_bytes()) {
            return Err(ServiceError::Unauthorized("signature verification failed".into()));
        }

        Ok(WalletAuth {
            wallet_hex,
            wallet_bytes,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use axum::middleware;
    use axum::routing::get;
    use axum::Router;
    use http_body_util::BodyExt;
    use tower::{Service, ServiceExt};

    fn app(token: &str) -> Router {
        Router::new()
            .route("/protected", get(|| async { "ok" }))
            .layer(middleware::from_fn(require_bearer))
            .layer(Extension(ApiToken::new(token.to_string())))
    }

    async fn status(app: &mut Router, req: Request<Body>) -> StatusCode {
        app.as_service().ready().await.unwrap().call(req).await.unwrap().status()
    }

    async fn body_json(app: &mut Router, req: Request<Body>) -> serde_json::Value {
        let resp = app.as_service().ready().await.unwrap().call(req).await.unwrap();
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    #[tokio::test]
    async fn valid_token_passes() {
        let mut app = app("secret");
        let req = Request::builder()
            .uri("/protected")
            .header("authorization", "Bearer secret")
            .body(Body::empty())
            .unwrap();
        assert_eq!(status(&mut app, req).await, StatusCode::OK);
    }

    #[tokio::test]
    async fn wrong_token_returns_401() {
        let mut app = app("secret");
        let req = Request::builder()
            .uri("/protected")
            .header("authorization", "Bearer wrong")
            .body(Body::empty())
            .unwrap();
        assert_eq!(status(&mut app, req).await, StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn missing_header_returns_401() {
        let mut app = app("secret");
        let req = Request::builder()
            .uri("/protected")
            .body(Body::empty())
            .unwrap();
        assert_eq!(status(&mut app, req).await, StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn malformed_header_returns_401() {
        let mut app = app("secret");
        let req = Request::builder()
            .uri("/protected")
            .header("authorization", "Token secret")
            .body(Body::empty())
            .unwrap();
        assert_eq!(status(&mut app, req).await, StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn unauthorized_body_has_error_field() {
        let mut app = app("secret");
        let req = Request::builder()
            .uri("/protected")
            .body(Body::empty())
            .unwrap();
        let json = body_json(&mut app, req).await;
        assert_eq!(json["error"], "unauthorized");
    }
}

#[cfg(test)]
mod wallet_auth_tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use axum::routing::get;
    use axum::Router;
    use http_body_util::BodyExt;
    use solana_sdk::signature::Keypair;
    use solana_sdk::signer::Signer;
    use tower::ServiceExt;

    async fn handler(auth: WalletAuth) -> String {
        format!("ok:{}", auth.wallet_hex)
    }

    fn wallet_app() -> Router {
        wallet_app_with_bypass(false)
    }

    fn wallet_app_with_bypass(allow: bool) -> Router {
        Router::new()
            .route("/credentials/{wallet}", get(handler))
            .layer(Extension(AllowUnauthenticated(allow)))
    }

    fn sign_request(
        keypair: &Keypair,
        wallet_hex: &str,
        timestamp: u64,
    ) -> (String, String) {
        let message = format!("zksettle:{wallet_hex}:{timestamp}");
        let sig = keypair.sign_message(message.as_bytes());
        (sig.to_string(), timestamp.to_string())
    }

    fn now_secs() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    #[tokio::test]
    async fn valid_signature_passes() {
        let kp = Keypair::new();
        let wallet_hex = format!("0x{}", hex::encode(kp.pubkey().to_bytes()));
        let ts = now_secs();
        let (sig, ts_str) = sign_request(&kp, &wallet_hex, ts);

        let resp = wallet_app()
            .oneshot(
                Request::builder()
                    .uri(&format!("/credentials/{wallet_hex}"))
                    .header("x-wallet-signature", &sig)
                    .header("x-wallet-timestamp", &ts_str)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body = String::from_utf8(bytes.to_vec()).unwrap();
        assert!(body.contains(&wallet_hex));
    }

    #[tokio::test]
    async fn missing_headers_returns_401() {
        let kp = Keypair::new();
        let wallet_hex = format!("0x{}", hex::encode(kp.pubkey().to_bytes()));

        let resp = wallet_app()
            .oneshot(
                Request::builder()
                    .uri(&format!("/credentials/{wallet_hex}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 401);
    }

    #[tokio::test]
    async fn expired_timestamp_returns_401() {
        let kp = Keypair::new();
        let wallet_hex = format!("0x{}", hex::encode(kp.pubkey().to_bytes()));
        let old_ts = now_secs() - 600;
        let (sig, ts_str) = sign_request(&kp, &wallet_hex, old_ts);

        let resp = wallet_app()
            .oneshot(
                Request::builder()
                    .uri(&format!("/credentials/{wallet_hex}"))
                    .header("x-wallet-signature", &sig)
                    .header("x-wallet-timestamp", &ts_str)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 401);
    }

    #[tokio::test]
    async fn wrong_key_returns_401() {
        let kp = Keypair::new();
        let other_kp = Keypair::new();
        let wallet_hex = format!("0x{}", hex::encode(kp.pubkey().to_bytes()));
        let ts = now_secs();
        let (sig, ts_str) = sign_request(&other_kp, &wallet_hex, ts);

        let resp = wallet_app()
            .oneshot(
                Request::builder()
                    .uri(&format!("/credentials/{wallet_hex}"))
                    .header("x-wallet-signature", &sig)
                    .header("x-wallet-timestamp", &ts_str)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 401);
    }

    #[tokio::test]
    async fn malformed_signature_returns_401() {
        let kp = Keypair::new();
        let wallet_hex = format!("0x{}", hex::encode(kp.pubkey().to_bytes()));
        let ts = now_secs();

        let resp = wallet_app()
            .oneshot(
                Request::builder()
                    .uri(&format!("/credentials/{wallet_hex}"))
                    .header("x-wallet-signature", "not-a-sig")
                    .header("x-wallet-timestamp", ts.to_string())
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 401);
    }

    #[tokio::test]
    async fn dev_bypass_skips_sig_check() {
        let kp = Keypair::new();
        let wallet_hex = format!("0x{}", hex::encode(kp.pubkey().to_bytes()));

        let resp = wallet_app_with_bypass(true)
            .oneshot(
                Request::builder()
                    .uri(&format!("/credentials/{wallet_hex}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
    }
}
