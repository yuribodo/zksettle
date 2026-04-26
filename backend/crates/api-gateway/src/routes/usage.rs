use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use zksettle_types::gateway::{DailyUsage, Tier, UsageRecord};

use crate::auth::AuthenticatedKey;
use crate::error::GatewayError;
use crate::metering;
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
) -> Result<Json<UsageResponse>, GatewayError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let usage = metering::get(&state.db, &record.key_hash, now).await?;

    Ok(Json(UsageResponse {
        tier: record.tier,
        monthly_limit: record.tier.monthly_limit(),
        usage,
    }))
}

pub async fn get_usage_history(
    State(state): State<Arc<AppState>>,
    AuthenticatedKey(record): AuthenticatedKey,
    Query(q): Query<HistoryQuery>,
) -> Result<Json<UsageHistoryResponse>, GatewayError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let days = q
        .days
        .unwrap_or(DEFAULT_HISTORY_DAYS)
        .clamp(1, MAX_HISTORY_DAYS);
    let history = metering::daily_history(&state.db, &record.key_hash, now, days).await?;

    Ok(Json(UsageHistoryResponse {
        tier: record.tier,
        monthly_limit: record.tier.monthly_limit(),
        history,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    use crate::{build_router, key_store, test_cleanup, test_state};
    use serial_test::serial;

    async fn cleanup_and_seed(state: &Arc<crate::AppState>, raw_key: &str, owner: &str) {
        test_cleanup(&state.db).await;
        key_store::insert(&state.db, raw_key, owner.into(), Tier::Developer, 1000)
            .await
            .unwrap();
    }

    #[tokio::test]
    #[serial]
    async fn usage_requires_auth() {
        let state = test_state().await;
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
    #[serial]
    async fn usage_returns_zero_for_new_key() {
        let state = test_state().await;
        let raw_key = "test-key-for-usage";
        cleanup_and_seed(&state, raw_key, "bob").await;

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
    #[serial]
    async fn usage_history_requires_auth() {
        let state = test_state().await;
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
    #[serial]
    async fn usage_history_defaults_to_30_days() {
        let state = test_state().await;
        let raw_key = "key-history";
        cleanup_and_seed(&state, raw_key, "carol").await;

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
    #[serial]
    async fn usage_history_respects_days_param() {
        let state = test_state().await;
        let raw_key = "key-history-7";
        cleanup_and_seed(&state, raw_key, "dave").await;

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
    #[serial]
    async fn usage_history_clamps_max_days() {
        let state = test_state().await;
        let raw_key = "key-history-cap";
        cleanup_and_seed(&state, raw_key, "eve").await;

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
    #[serial]
    async fn usage_history_clamps_zero_to_one_day() {
        let state = test_state().await;
        let raw_key = "key-history-zero";
        cleanup_and_seed(&state, raw_key, "frank").await;

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
