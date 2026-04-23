use axum::extract::Request;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Extension;
use serde_json::json;
use subtle::ConstantTimeEq;

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
    let authorized = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|bearer| {
            bearer.as_bytes().ct_eq(token.as_bytes()).into()
        })
        .unwrap_or(false);

    if !authorized {
        let body = axum::Json(json!({ "error": "unauthorized" }));
        return (StatusCode::UNAUTHORIZED, body).into_response();
    }

    next.run(req).await
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
