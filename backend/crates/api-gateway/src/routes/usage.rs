use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use zksettle_types::gateway::{DailyUsage, Tier, UsageRecord};

use crate::auth::AuthenticatedKey;
use crate::AppState;

const DEFAULT_HISTORY_DAYS: u32 = 30;
const MAX_HISTORY_DAYS: u32 = 365;

#[derive(Serialize, Deserialize)]
pub struct UsageResponse {
    pub tier: Tier,
    pub monthly_limit: u64,
    pub usage: UsageRecord,
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub days: Option<u32>,
}

#[derive(Serialize, Deserialize)]
pub struct UsageHistoryResponse {
    pub tier: Tier,
    pub monthly_limit: u64,
    pub history: Vec<DailyUsage>,
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

pub async fn get_usage_history(
    State(state): State<Arc<AppState>>,
    AuthenticatedKey(record): AuthenticatedKey,
    Query(q): Query<HistoryQuery>,
) -> Json<UsageHistoryResponse> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let days = q
        .days
        .unwrap_or(DEFAULT_HISTORY_DAYS)
        .clamp(1, MAX_HISTORY_DAYS);
    let history = state.metering.daily_history(&record.key_hash, now, days);

    Json(UsageHistoryResponse {
        tier: record.tier,
        monthly_limit: record.tier.monthly_limit(),
        history,
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

    #[tokio::test]
    async fn usage_history_requires_auth() {
        let state = test_state();
        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/usage/history")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 401);
    }

    #[tokio::test]
    async fn usage_history_defaults_to_30_days() {
        let state = test_state();
        let raw_key = "key-history";
        state
            .keys
            .insert(raw_key, "carol".into(), Tier::Developer, 1000);

        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/usage/history")
                    .header("authorization", format!("Bearer {raw_key}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: UsageHistoryResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.history.len(), 30);
        assert!(body.history.iter().all(|d| d.count == 0));
        assert_eq!(body.tier, Tier::Developer);
        assert_eq!(body.monthly_limit, 1_000);
    }

    #[tokio::test]
    async fn usage_history_respects_days_param() {
        let state = test_state();
        let raw_key = "key-history-7";
        state
            .keys
            .insert(raw_key, "dave".into(), Tier::Developer, 1000);

        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/usage/history?days=7")
                    .header("authorization", format!("Bearer {raw_key}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: UsageHistoryResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.history.len(), 7);
    }

    #[tokio::test]
    async fn usage_history_clamps_max_days() {
        let state = test_state();
        let raw_key = "key-history-cap";
        state
            .keys
            .insert(raw_key, "eve".into(), Tier::Developer, 1000);

        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/usage/history?days=99999")
                    .header("authorization", format!("Bearer {raw_key}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: UsageHistoryResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.history.len(), MAX_HISTORY_DAYS as usize);
    }

    #[tokio::test]
    async fn usage_history_clamps_zero_to_one_day() {
        let state = test_state();
        let raw_key = "key-history-zero";
        state
            .keys
            .insert(raw_key, "frank".into(), Tier::Developer, 1000);

        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/usage/history?days=0")
                    .header("authorization", format!("Bearer {raw_key}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: UsageHistoryResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.history.len(), 1);
    }
}
