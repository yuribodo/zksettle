use std::sync::Arc;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use axum_extra::extract::cookie::{Cookie, SameSite};
use axum_extra::extract::CookieJar;
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::auth_jwt::AuthenticatedTenant;
use crate::error::GatewayError;
use crate::siws;
use crate::tenant_store;
use crate::jwt as jwt_mod;
use crate::AppState;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;

#[derive(Deserialize)]
pub struct LoginRequest {
    pub account: String,
    pub signed_message: String,
    pub signature: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub tenant_id: uuid::Uuid,
    pub wallet: String,
    pub tier: String,
}

#[derive(Serialize)]
pub struct MeResponse {
    pub tenant_id: uuid::Uuid,
    pub wallet: String,
    pub tier: String,
    pub name: Option<String>,
}

fn extract_client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|s| s.trim().to_owned())
        .unwrap_or_else(|| "unknown".into())
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(body): Json<LoginRequest>,
) -> Result<(CookieJar, Json<LoginResponse>), GatewayError> {
    let ip = extract_client_ip(&headers);
    if !state.login_rate_limiter.check(&ip) {
        return Err(GatewayError::RateLimited);
    }

    let secret = state
        .config
        .jwt_secret
        .as_deref()
        .ok_or_else(|| GatewayError::Config("jwt_secret not configured".into()))?;

    let message_bytes = BASE64
        .decode(&body.signed_message)
        .map_err(|_| GatewayError::InvalidMessage)?;

    let signature_bytes = BASE64
        .decode(&body.signature)
        .map_err(|_| GatewayError::InvalidSignature)?;

    let message_str =
        std::str::from_utf8(&message_bytes).map_err(|_| GatewayError::InvalidMessage)?;

    let parsed = siws::parse_message(message_str)?;

    if parsed.address != body.account {
        return Err(GatewayError::InvalidMessage);
    }

    let now = crate::now_secs();

    siws::validate_message(&parsed, now, state.config.siws_domain.as_deref())?;
    siws::verify_signature(&body.account, &message_bytes, &signature_bytes)?;

    let tenant = tenant_store::find_or_create(&state.db, &body.account, now).await?;

    let token = jwt_mod::issue(tenant.id, &tenant.wallet, secret, state.config.jwt_ttl_secs)?;

    info!(wallet = %tenant.wallet, tenant_id = %tenant.id, "tenant logged in");

    let same_site = match state.config.cookie_same_site {
        crate::config::CookieSameSite::Strict => SameSite::Strict,
        crate::config::CookieSameSite::Lax => SameSite::Lax,
        crate::config::CookieSameSite::None => SameSite::None,
    };
    let cookie = Cookie::build((crate::SESSION_COOKIE, token))
        .http_only(true)
        .secure(state.config.cookie_secure)
        .same_site(same_site)
        .path("/");

    Ok((
        jar.add(cookie),
        Json(LoginResponse {
            tenant_id: tenant.id,
            wallet: tenant.wallet,
            tier: tenant.tier,
        }),
    ))
}

pub async fn logout(jar: CookieJar) -> CookieJar {
    jar.remove(Cookie::build(crate::SESSION_COOKIE).path("/"))
}

pub async fn me(
    State(state): State<Arc<AppState>>,
    tenant: AuthenticatedTenant,
) -> Result<Json<MeResponse>, GatewayError> {
    let record = tenant_store::find_by_id(&state.db, tenant.tenant_id)
        .await?
        .ok_or(GatewayError::Unauthorized)?;

    Ok(Json(MeResponse {
        tenant_id: record.id,
        wallet: record.wallet,
        tier: record.tier,
        name: record.name,
    }))
}
