use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use zksettle_types::gateway::{Tier, UsageRecord};

use crate::auth::AuthenticatedKey;
use crate::AppState;

#[derive(Serialize, Deserialize)]
pub struct UsageResponse {
    pub tier: Tier,
    pub monthly_limit: u64,
    pub usage: UsageRecord,
}

pub async fn get_usage(
    State(state): State<Arc<AppState>>,
    AuthenticatedKey(record): AuthenticatedKey,
) -> Json<UsageResponse> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let usage = state.metering.get(&record.key_hash, now);

    Json(UsageResponse {
        tier: record.tier,
        monthly_limit: record.tier.monthly_limit(),
        usage,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    use crate::{build_router, test_state};

    #[tokio::test]
    async fn usage_requires_auth() {
        let state = test_state();
        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/usage")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 401);
    }

    #[tokio::test]
    async fn usage_returns_zero_for_new_key() {
        let state = test_state();

        // Insert key directly via state
        let raw_key = "test-key-for-usage";
        state
            .keys
            .insert(raw_key, "bob".into(), Tier::Developer, 1000);

        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/usage")
                    .header("authorization", format!("Bearer {raw_key}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: UsageResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.usage.request_count, 0);
        assert_eq!(body.tier, Tier::Developer);
    }
}
