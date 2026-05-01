use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use sea_orm::{ColumnTrait, Condition, EntityTrait, QueryFilter, QueryOrder, QuerySelect};
use serde::{Deserialize, Serialize};

use crate::entity::event::{Column, Entity as EventEntity, Model as EventModel};
use crate::error::IndexerError;
use crate::AppState;

#[derive(Deserialize)]
pub struct ListEventsQuery {
    pub cursor: Option<String>,
    pub limit: Option<u64>,
    pub from_ts: Option<i64>,
    pub to_ts: Option<i64>,
    pub issuer: Option<String>,
    pub recipient: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ListEventsResponse {
    pub events: Vec<EventModel>,
    pub next_cursor: Option<String>,
}

fn encode_cursor(slot: i64, id: i32) -> String {
    let mut buf = [0u8; 12];
    buf[..8].copy_from_slice(&slot.to_le_bytes());
    buf[8..].copy_from_slice(&id.to_le_bytes());
    URL_SAFE_NO_PAD.encode(buf)
}

fn decode_cursor(cursor: &str) -> Result<(i64, i32), IndexerError> {
    let bytes = URL_SAFE_NO_PAD
        .decode(cursor)
        .map_err(|_| IndexerError::InvalidCursor)?;
    if bytes.len() != 12 {
        return Err(IndexerError::InvalidCursor);
    }
    let slot = i64::from_le_bytes(bytes[..8].try_into().unwrap());
    let id = i32::from_le_bytes(bytes[8..].try_into().unwrap());
    Ok((slot, id))
}

pub async fn list_events(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListEventsQuery>,
) -> Result<Json<ListEventsResponse>, IndexerError> {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);

    let mut query = EventEntity::find()
        .order_by_desc(Column::Slot)
        .order_by_desc(Column::Id);

    if let Some(ref cursor) = params.cursor {
        let (cursor_slot, cursor_id) = decode_cursor(cursor)?;
        query = query.filter(
            Condition::any()
                .add(Column::Slot.lt(cursor_slot))
                .add(
                    Condition::all()
                        .add(Column::Slot.eq(cursor_slot))
                        .add(Column::Id.lt(cursor_id)),
                ),
        );
    }
    if let Some(from_ts) = params.from_ts {
        query = query.filter(Column::Timestamp.gte(from_ts));
    }
    if let Some(to_ts) = params.to_ts {
        query = query.filter(Column::Timestamp.lte(to_ts));
    }
    if let Some(ref issuer) = params.issuer {
        query = query.filter(Column::Issuer.eq(issuer));
    }
    if let Some(ref recipient) = params.recipient {
        query = query.filter(Column::Recipient.eq(recipient));
    }

    // Route only registered when db is Some (see build_router)
    let db = state.db.as_ref().unwrap();

    let mut rows = query
        .limit(limit + 1)
        .all(db)
        .await
        .map_err(|e| IndexerError::Database(e.to_string()))?;

    let next_cursor = if rows.len() > limit as usize {
        let last = rows.pop().unwrap();
        Some(encode_cursor(last.slot, last.id))
    } else {
        None
    };

    Ok(Json(ListEventsResponse {
        events: rows,
        next_cursor,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cursor_roundtrip() {
        let encoded = encode_cursor(500, 42);
        let (slot, id) = decode_cursor(&encoded).unwrap();
        assert_eq!(slot, 500);
        assert_eq!(id, 42);
    }

    #[test]
    fn invalid_cursor_returns_error() {
        assert!(decode_cursor("not-valid!!!").is_err());
    }

    #[test]
    fn cursor_wrong_length_returns_error() {
        let short = URL_SAFE_NO_PAD.encode([0u8; 4]);
        assert!(decode_cursor(&short).is_err());
    }

    #[test]
    fn cursor_roundtrip_edge_values() {
        for (slot, id) in [(0, 0), (1, 1), (i64::MAX, i32::MAX), (-1, -1)] {
            let encoded = encode_cursor(slot, id);
            let (s, i) = decode_cursor(&encoded).unwrap();
            assert_eq!(s, slot);
            assert_eq!(i, id);
        }
    }
}

#[cfg(test)]
mod integration_tests {
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use sea_orm::{EntityTrait, Set};
    use serial_test::serial;
    use tower::ServiceExt;

    use super::*;
    use crate::entity::event;
    use crate::test_app_with_db;

    async fn parse_body<T: serde::de::DeserializeOwned>(
        resp: axum::http::Response<Body>,
    ) -> T {
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    async fn insert_test_event(
        db: &sea_orm::DatabaseConnection,
        index: i64,
        timestamp: i64,
        issuer: &str,
        recipient: &str,
        nullifier_hash: &str,
    ) {
        let active = event::ActiveModel {
            id: Default::default(),
            signature: Set(format!("sig_{index}")),
            slot: Set(100 + index),
            timestamp: Set(timestamp),
            issuer: Set(issuer.to_string()),
            nullifier_hash: Set(nullifier_hash.to_string()),
            merkle_root: Set(format!("mr_{index}")),
            sanctions_root: Set(format!("sr_{index}")),
            jurisdiction_root: Set(format!("jr_{index}")),
            mint: Set("mint_a".to_string()),
            recipient: Set(recipient.to_string()),
            amount: Set(1_000_000),
            epoch: Set(1),
        };
        event::Entity::insert(active).exec(db).await.unwrap();
    }

    #[tokio::test]
    #[serial]
    async fn list_events_empty_db() {
        let (app, _tmp, _state) = test_app_with_db().await;
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let body: ListEventsResponse = parse_body(resp).await;
        assert!(body.events.is_empty());
        assert!(body.next_cursor.is_none());
    }

    #[tokio::test]
    #[serial]
    async fn list_events_returns_newest_first() {
        let (app, _tmp, state) = test_app_with_db().await;
        let db = state.db.as_ref().unwrap();

        for i in 0..3 {
            insert_test_event(db, i, 1_700_000_000 + i, "issuerA", "recipA", &format!("nh_{i}")).await;
        }

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body: ListEventsResponse = parse_body(resp).await;
        assert_eq!(body.events.len(), 3);
        assert!(body.events[0].slot >= body.events[1].slot);
        assert!(body.events[1].slot >= body.events[2].slot);
    }

    #[tokio::test]
    #[serial]
    async fn list_events_cursor_pagination() {
        let (app, _tmp, state) = test_app_with_db().await;
        let db = state.db.as_ref().unwrap();

        for i in 0..5 {
            insert_test_event(db, i, 1_700_000_000, "issuerA", "recipA", &format!("nh_{i}")).await;
        }

        // Page 1: limit=3
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/events?limit=3")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let page1: ListEventsResponse = parse_body(resp).await;
        assert_eq!(page1.events.len(), 3);
        assert!(page1.next_cursor.is_some());

        // Page 2: use cursor
        let cursor = page1.next_cursor.unwrap();
        let resp = app
            .oneshot(
                Request::builder()
                    .uri(&format!("/events?limit=3&cursor={cursor}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let page2: ListEventsResponse = parse_body(resp).await;
        assert_eq!(page2.events.len(), 2);
        assert!(page2.next_cursor.is_none());

        // No overlap
        let page1_ids: Vec<i32> = page1.events.iter().map(|e| e.id).collect();
        for e in &page2.events {
            assert!(!page1_ids.contains(&e.id));
        }
    }

    #[tokio::test]
    #[serial]
    async fn list_events_limit_clamped() {
        let (app, _tmp, _state) = test_app_with_db().await;
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events?limit=999")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
    }

    #[tokio::test]
    #[serial]
    async fn list_events_timestamp_filters() {
        let (app, _tmp, state) = test_app_with_db().await;
        let db = state.db.as_ref().unwrap();

        insert_test_event(db, 0, 100, "issA", "recA", "nh_t0").await;
        insert_test_event(db, 1, 200, "issA", "recA", "nh_t1").await;
        insert_test_event(db, 2, 300, "issA", "recA", "nh_t2").await;

        // from_ts only
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/events?from_ts=200")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body: ListEventsResponse = parse_body(resp).await;
        assert_eq!(body.events.len(), 2);

        // to_ts only
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/events?to_ts=200")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body: ListEventsResponse = parse_body(resp).await;
        assert_eq!(body.events.len(), 2);

        // combined
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events?from_ts=200&to_ts=200")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body: ListEventsResponse = parse_body(resp).await;
        assert_eq!(body.events.len(), 1);
        assert_eq!(body.events[0].timestamp, 200);
    }

    #[tokio::test]
    #[serial]
    async fn list_events_issuer_filter() {
        let (app, _tmp, state) = test_app_with_db().await;
        let db = state.db.as_ref().unwrap();

        insert_test_event(db, 0, 100, "alice", "bob", "nh_i0").await;
        insert_test_event(db, 1, 200, "carol", "bob", "nh_i1").await;

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events?issuer=alice")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body: ListEventsResponse = parse_body(resp).await;
        assert_eq!(body.events.len(), 1);
        assert_eq!(body.events[0].issuer, "alice");
    }

    #[tokio::test]
    #[serial]
    async fn list_events_recipient_filter() {
        let (app, _tmp, state) = test_app_with_db().await;
        let db = state.db.as_ref().unwrap();

        insert_test_event(db, 0, 100, "alice", "bob", "nh_r0").await;
        insert_test_event(db, 1, 200, "alice", "carol", "nh_r1").await;

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events?recipient=carol")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body: ListEventsResponse = parse_body(resp).await;
        assert_eq!(body.events.len(), 1);
        assert_eq!(body.events[0].recipient, "carol");
    }

    #[tokio::test]
    #[serial]
    async fn list_events_invalid_cursor_returns_400() {
        let (app, _tmp, _state) = test_app_with_db().await;
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events?cursor=garbage!!!")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 400);
    }
}
