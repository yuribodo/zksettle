use std::sync::Arc;

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum_extra::extract::CookieJar;
use uuid::Uuid;

use crate::error::GatewayError;
use crate::jwt;
use crate::AppState;

#[derive(Debug, Clone)]
pub struct AuthenticatedTenant {
    pub tenant_id: Uuid,
    pub wallet: String,
}

impl FromRequestParts<Arc<AppState>> for AuthenticatedTenant {
    type Rejection = GatewayError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let secret = state
            .config
            .jwt_secret
            .as_deref()
            .ok_or_else(|| GatewayError::Config("jwt_secret not configured".into()))?;

        let jar = CookieJar::from_headers(&parts.headers);
        let token = jar
            .get("session")
            .map(|c| c.value())
            .ok_or(GatewayError::Unauthorized)?;

        let claims = jwt::verify(token, secret)?;

        Ok(AuthenticatedTenant {
            tenant_id: claims.sub,
            wallet: claims.wallet,
        })
    }
}

#[derive(Debug, Clone)]
pub struct MaybeAuthenticatedTenant(pub Option<AuthenticatedTenant>);

impl FromRequestParts<Arc<AppState>> for MaybeAuthenticatedTenant {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        Ok(MaybeAuthenticatedTenant(
            AuthenticatedTenant::from_request_parts(parts, state)
                .await
                .ok(),
        ))
    }
}
