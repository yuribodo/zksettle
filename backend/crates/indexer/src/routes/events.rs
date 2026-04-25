use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::error::IndexerError;
use crate::events_store::{Cursor, EventFilter, StoredEvent};
use crate::AppState;

const DEFAULT_LIMIT: usize = 50;
const MAX_LIMIT: usize = 200;

#[derive(Deserialize, Default)]
pub struct ListEventsQuery {
    pub cursor: Option<String>,
    pub limit: Option<usize>,
    pub from_ts: Option<u64>,
    pub to_ts: Option<u64>,
    /// 32-byte issuer pubkey, hex encoded (64 chars).
    pub issuer: Option<String>,
    /// 32-byte recipient pubkey, hex encoded (64 chars).
    pub recipient: Option<String>,
}

fn parse_hex32(field: &str, raw: &str) -> Result<[u8; 32], IndexerError> {
    let trimmed = raw.trim_start_matches("0x");
    let bytes = hex::decode(trimmed).map_err(|_| {
        IndexerError::Config(format!("{field} must be 64 hex chars (with optional 0x prefix)"))
    })?;
    if bytes.len() != 32 {
        return Err(IndexerError::Config(format!(
            "{field} must decode to exactly 32 bytes, got {}",
            bytes.len()
        )));
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Ok(out)
}

#[derive(Serialize, Deserialize)]
pub struct EventDto {
    pub signature: String,
    pub slot: u64,
    pub timestamp: u64,
    pub issuer: String,
    pub nullifier_hash: String,
    pub merkle_root: String,
    pub sanctions_root: String,
    pub jurisdiction_root: String,
    pub mint: String,
    pub recipient: String,
    pub payer: String,
    pub amount: u64,
    pub epoch: u64,
}

impl From<StoredEvent> for EventDto {
    fn from(e: StoredEvent) -> Self {
        Self {
            signature: e.signature,
            slot: e.slot,
            timestamp: e.timestamp,
            issuer: hex::encode(e.issuer),
            nullifier_hash: hex::encode(e.nullifier_hash),
            merkle_root: hex::encode(e.merkle_root),
            sanctions_root: hex::encode(e.sanctions_root),
            jurisdiction_root: hex::encode(e.jurisdiction_root),
            mint: hex::encode(e.mint),
            recipient: hex::encode(e.recipient),
            payer: hex::encode(e.payer),
            amount: e.amount,
            epoch: e.epoch,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct ListEventsResponse {
    pub events: Vec<EventDto>,
    /// Opaque cursor to pass back as `?cursor=` for the next page. `null` when
    /// there are no more events.
    pub next_cursor: Option<String>,
}

pub async fn list_events(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ListEventsQuery>,
) -> Result<Json<ListEventsResponse>, IndexerError> {
    let limit = q.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let cursor = match q.cursor.as_deref() {
        None | Some("") => None,
        Some(token) => Some(
            Cursor::from_token(token)
                .map_err(|e| IndexerError::Config(format!("invalid cursor: {e}")))?,
        ),
    };

    let filter = EventFilter {
        from_ts: q.from_ts,
        to_ts: q.to_ts,
        issuer: q.issuer.as_deref().map(|s| parse_hex32("issuer", s)).transpose()?,
        recipient: q
            .recipient
            .as_deref()
            .map(|s| parse_hex32("recipient", s))
            .transpose()?,
    };

    let (events, next) = state.events.list_filtered(cursor, limit, &filter)?;
    Ok(Json(ListEventsResponse {
        events: events.into_iter().map(Into::into).collect(),
        next_cursor: next.map(|c| c.to_token()),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    use crate::events_store::StoredEvent;
    use crate::test_app;

    fn fixture(slot: u64, sig: &str) -> StoredEvent {
        StoredEvent {
            signature: sig.into(),
            slot,
            timestamp: slot * 100,
            issuer: [1u8; 32],
            nullifier_hash: [2u8; 32],
            merkle_root: [3u8; 32],
            sanctions_root: [4u8; 32],
            jurisdiction_root: [5u8; 32],
            mint: [6u8; 32],
            recipient: [7u8; 32],
            payer: [8u8; 32],
            amount: 1_000 * slot,
            epoch: 1,
        }
    }

    /// Build an app and seed it with the given events. Returns the app plus
    /// the tempdir holding the rocksdb data so it lives for the test.
    fn app_with_events(seeds: &[(u64, &str)]) -> (axum::Router, tempfile::TempDir) {
        // We can't easily reach into AppState from oneshot; rebuild with our own state.
        use crate::events_store::EventStore;
        use std::sync::Arc;

        let tmp = tempfile::tempdir().unwrap();
        let dedup_dir = tmp.path().join("dedup");
        let events_dir = tmp.path().join("events");
        std::fs::create_dir_all(&dedup_dir).unwrap();
        std::fs::create_dir_all(&events_dir).unwrap();

        let dedup = crate::dedup::NullifierStore::open(
            &dedup_dir,
            1_000_000,
            std::time::Duration::from_secs(86400),
        )
        .unwrap();
        let events = EventStore::open(&events_dir).unwrap();
        for (slot, sig) in seeds {
            events.insert(&fixture(*slot, sig)).unwrap();
        }

        let config = crate::config::Config {
            port: 3000,
            helius_auth_token: "test-token".into(),
            irys_node_url: "http://localhost:0".into(),
            irys_wallet_key: None,
            program_id: "11111111111111111111111111111111".into(),
            log_level: "error".into(),
            dedup_path: dedup_dir.to_string_lossy().into_owned(),
            dedup_capacity: 1_000_000,
            dedup_ttl_secs: 86400,
            events_path: events_dir.to_string_lossy().into_owned(),
        };
        let irys: Arc<dyn crate::irys::IrysUploader> =
            Arc::new(crate::irys::client::IrysClient::new(
                config.irys_node_url.clone(),
                None,
                reqwest::Client::new(),
            ));
        let state = Arc::new(crate::AppState {
            config,
            irys,
            dedup,
            events,
        });
        (crate::build_router(state), tmp)
    }

    #[tokio::test]
    async fn list_events_empty_when_no_data() {
        let (app, _tmp) = test_app();
        let resp = app
            .oneshot(Request::builder().uri("/events").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body["events"].as_array().unwrap().len(), 0);
        assert!(body["next_cursor"].is_null());
    }

    #[tokio::test]
    async fn list_events_returns_newest_first() {
        let (app, _tmp) = app_with_events(&[(100, "a"), (200, "b"), (150, "c")]);
        let resp = app
            .oneshot(Request::builder().uri("/events").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: ListEventsResponse = serde_json::from_slice(&bytes).unwrap();
        let slots: Vec<u64> = body.events.iter().map(|e| e.slot).collect();
        assert_eq!(slots, vec![200, 150, 100]);
        assert!(body.next_cursor.is_none());
    }

    #[tokio::test]
    async fn list_events_paginates_with_cursor() {
        let seeds: Vec<(u64, &str)> =
            (1..=5u64).map(|s| (s, ["a", "b", "c", "d", "e"][(s - 1) as usize])).collect();
        let (app, _tmp) = app_with_events(&seeds);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/events?limit=2")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let page1: ListEventsResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(page1.events.len(), 2);
        assert_eq!(page1.events[0].slot, 5);
        assert_eq!(page1.events[1].slot, 4);
        let cursor = page1.next_cursor.expect("first page should have a cursor");

        let resp = app
            .oneshot(
                Request::builder()
                    .uri(format!("/events?limit=2&cursor={cursor}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let page2: ListEventsResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(page2.events.len(), 2);
        assert_eq!(page2.events[0].slot, 3);
        assert_eq!(page2.events[1].slot, 2);
    }

    #[tokio::test]
    async fn list_events_invalid_cursor_500() {
        let (app, _tmp) = app_with_events(&[(1, "x")]);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events?cursor=not_valid_$$$")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 500);
    }

    #[tokio::test]
    async fn list_events_clamps_limit() {
        let seeds: Vec<(u64, String)> =
            (1..=10u64).map(|s| (s, format!("sig-{s}"))).collect();
        let seeds_ref: Vec<(u64, &str)> = seeds.iter().map(|(s, sig)| (*s, sig.as_str())).collect();
        let (app, _tmp) = app_with_events(&seeds_ref);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events?limit=99999")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: ListEventsResponse = serde_json::from_slice(&bytes).unwrap();
        // Only 10 events seeded, all returned.
        assert_eq!(body.events.len(), 10);
    }

    #[tokio::test]
    async fn list_events_filters_by_issuer() {
        // Build manually so we can vary issuer.
        use crate::events_store::EventStore;
        use std::sync::Arc;
        let tmp = tempfile::tempdir().unwrap();
        let dedup_dir = tmp.path().join("dedup");
        let events_dir = tmp.path().join("events");
        std::fs::create_dir_all(&dedup_dir).unwrap();
        std::fs::create_dir_all(&events_dir).unwrap();
        let dedup = crate::dedup::NullifierStore::open(
            &dedup_dir,
            1_000_000,
            std::time::Duration::from_secs(86400),
        )
        .unwrap();
        let events = EventStore::open(&events_dir).unwrap();

        let mut a = fixture(10, "a");
        a.issuer = [0xAAu8; 32];
        let mut b = fixture(20, "b");
        b.issuer = [0xBBu8; 32];
        let mut c = fixture(30, "c");
        c.issuer = [0xAAu8; 32];
        events.insert(&a).unwrap();
        events.insert(&b).unwrap();
        events.insert(&c).unwrap();

        let config = crate::config::Config {
            port: 3000,
            helius_auth_token: "test-token".into(),
            irys_node_url: "http://localhost:0".into(),
            irys_wallet_key: None,
            program_id: "11111111111111111111111111111111".into(),
            log_level: "error".into(),
            dedup_path: dedup_dir.to_string_lossy().into_owned(),
            dedup_capacity: 1_000_000,
            dedup_ttl_secs: 86400,
            events_path: events_dir.to_string_lossy().into_owned(),
        };
        let irys: Arc<dyn crate::irys::IrysUploader> =
            Arc::new(crate::irys::client::IrysClient::new(
                config.irys_node_url.clone(),
                None,
                reqwest::Client::new(),
            ));
        let state = Arc::new(crate::AppState {
            config,
            irys,
            dedup,
            events,
        });
        let app = crate::build_router(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri(format!("/events?issuer={}", hex::encode([0xAAu8; 32])))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: ListEventsResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.events.len(), 2);
        let slots: Vec<u64> = body.events.iter().map(|e| e.slot).collect();
        assert_eq!(slots, vec![30, 10]);
    }

    #[tokio::test]
    async fn list_events_filters_by_timestamp_range() {
        let (app, _tmp) = app_with_events(&[(10, "a"), (20, "b"), (30, "c")]);
        // fixture timestamps: slot * 100 → 1000, 2000, 3000
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events?from_ts=1500&to_ts=2500")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: ListEventsResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.events.len(), 1);
        assert_eq!(body.events[0].slot, 20);
    }

    #[tokio::test]
    async fn list_events_with_0x_prefix_is_accepted() {
        let (app, _tmp) = app_with_events(&[(10, "a")]);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri(format!("/events?issuer=0x{}", hex::encode([1u8; 32])))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: ListEventsResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.events.len(), 1);
    }

    #[tokio::test]
    async fn list_events_invalid_hex_returns_500() {
        let (app, _tmp) = app_with_events(&[(10, "a")]);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events?issuer=not-hex")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        // Parse failure surfaces as Config error → 500.
        assert_eq!(resp.status(), 500);
    }

    #[tokio::test]
    async fn list_events_wrong_byte_length_returns_500() {
        let (app, _tmp) = app_with_events(&[(10, "a")]);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/events?recipient=deadbeef")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 500);
    }

    #[tokio::test]
    async fn event_dto_encodes_bytes_as_hex() {
        let (app, _tmp) = app_with_events(&[(42, "deadbeef")]);
        let resp = app
            .oneshot(Request::builder().uri("/events").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: ListEventsResponse = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body.events[0].issuer, hex::encode([1u8; 32]));
        assert_eq!(body.events[0].nullifier_hash, hex::encode([2u8; 32]));
        assert_eq!(body.events[0].amount, 42_000);
    }
}
