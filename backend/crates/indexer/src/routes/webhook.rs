use std::sync::Arc;

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use sea_orm::{EntityTrait, Set, sea_query::OnConflict};
use tracing::{error, info, warn};

use crate::entity::event;
use crate::helius::parse::extract_proof_settled;
use crate::helius::payload::HeliusTransaction;
use crate::AppState;

pub async fn handle_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(transactions): Json<Vec<HeliusTransaction>>,
) -> StatusCode {
    if !verify_auth(&headers, &state.config.helius_auth_token) {
        return StatusCode::UNAUTHORIZED;
    }

    for tx in &transactions {
        let events = match extract_proof_settled(&tx.log_messages) {
            Ok(events) => events,
            Err(e) => {
                warn!(
                    signature = %tx.signature,
                    error = %e,
                    "failed to parse events"
                );
                continue;
            }
        };

        for event in &events {
            if state.dedup.contains(&event.nullifier_hash) {
                info!(
                    nullifier = hex::encode(event.nullifier_hash),
                    "duplicate nullifier, skipping"
                );
                continue;
            }

            match state.irys.upload(event).await {
                Ok(_) => {
                    if let Some(db) = &state.db {
                        let active = event::ActiveModel {
                            id: Default::default(),
                            signature: Set(tx.signature.clone()),
                            slot: Set(tx.slot as i64),
                            timestamp: Set(tx.timestamp),
                            issuer: Set(bs58::encode(event.issuer).into_string()),
                            nullifier_hash: Set(hex::encode(event.nullifier_hash)),
                            merkle_root: Set(hex::encode(event.merkle_root)),
                            sanctions_root: Set(hex::encode(event.sanctions_root)),
                            jurisdiction_root: Set(hex::encode(event.jurisdiction_root)),
                            mint: Set(bs58::encode(event.mint).into_string()),
                            recipient: Set(bs58::encode(event.recipient).into_string()),
                            payer: Set(bs58::encode(event.payer).into_string()),
                            amount: Set(event.amount as i64),
                            epoch: Set(event.epoch as i64),
                        };
                        if let Err(e) = event::Entity::insert(active)
                            .on_conflict(
                                OnConflict::column(event::Column::NullifierHash)
                                    .do_nothing()
                                    .to_owned(),
                            )
                            .do_nothing()
                            .exec(db)
                            .await
                        {
                            error!(
                                nullifier = hex::encode(event.nullifier_hash),
                                error = %e,
                                "failed to store event in database"
                            );
                        }
                    }

                    if let Err(e) = state.dedup.mark_uploaded(&event.nullifier_hash) {
                        error!(
                            nullifier = hex::encode(event.nullifier_hash),
                            error = %e,
                            "failed to persist nullifier after successful upload"
                        );
                    }
                }
                Err(e) => {
                    error!(
                        nullifier = hex::encode(event.nullifier_hash),
                        error = %e,
                        "irys upload failed, will retry on next webhook delivery"
                    );
                }
            }
        }
    }

    StatusCode::OK
}

fn verify_auth(headers: &HeaderMap, expected: &str) -> bool {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .is_some_and(|token| token == expected)
}

#[cfg(test)]
mod tests {
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    use crate::test_app;

    #[tokio::test]
    async fn missing_auth_returns_401() {
        let (app, _tmp) = test_app();
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/helius")
                    .header("content-type", "application/json")
                    .body(Body::from("[]"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 401);
    }

    #[tokio::test]
    async fn valid_empty_batch_returns_200() {
        let (app, _tmp) = test_app();
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/helius")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer test-token")
                    .body(Body::from("[]"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
    }

    #[tokio::test]
    async fn malformed_json_returns_422() {
        let (app, _tmp) = test_app();
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/helius")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer test-token")
                    .body(Body::from("{not json"))
                    .unwrap(),
            )
            .await
            .unwrap();
        // axum returns 422 for deserialization failures
        assert_eq!(resp.status(), 422);
    }

    #[tokio::test]
    async fn health_returns_200() {
        let (app, _tmp) = test_app();
        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
    }

    #[tokio::test]
    async fn webhook_with_no_events_returns_200() {
        let (app, _tmp) = test_app();
        let payload = serde_json::json!([{
            "signature": "abc123",
            "slot": 100,
            "timestamp": 1700000000i64,
            "logMessages": ["Program log: something irrelevant"]
        }]);
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/helius")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer test-token")
                    .body(Body::from(serde_json::to_string(&payload).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
    }

    #[tokio::test]
    async fn duplicate_nullifier_still_returns_200() {
        use base64::engine::general_purpose::STANDARD;
        use base64::Engine;
        use sha2::{Digest, Sha256};
        use zksettle_types::ProofSettled;

        let event = ProofSettled {
            issuer: [1u8; 32],
            nullifier_hash: [2u8; 32],
            merkle_root: [3u8; 32],
            sanctions_root: [4u8; 32],
            jurisdiction_root: [5u8; 32],
            mint: [6u8; 32],
            recipient: [7u8; 32],
            amount: 1_000_000,
            epoch: 3,
            timestamp: 1_700_000_000,
            slot: 500,
            payer: [8u8; 32],
        };
        let disc = {
            let hash = Sha256::digest(b"event:ProofSettled");
            let mut d = [0u8; 8];
            d.copy_from_slice(&hash[..8]);
            d
        };
        let mut buf = Vec::new();
        buf.extend_from_slice(&disc);
        buf.extend_from_slice(&borsh::to_vec(&event).unwrap());
        let b64 = STANDARD.encode(&buf);

        let payload = serde_json::json!([{
            "signature": "tx1",
            "slot": 500,
            "timestamp": 1700000000i64,
            "logMessages": [format!("Program data: {b64}")]
        }]);
        let body = serde_json::to_string(&payload).unwrap();

        let (app, _tmp) = test_app();

        // First request
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/helius")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer test-token")
                    .body(Body::from(body.clone()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);

        // Duplicate
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/helius")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer test-token")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);
    }
}

#[cfg(test)]
mod integration_tests {
    use axum::body::Body;
    use axum::http::Request;
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
    use serial_test::serial;
    use tower::ServiceExt;

    use crate::entity::event;
    use crate::test_app_with_db;

    fn make_webhook_payload(
        event: &zksettle_types::ProofSettled,
        signature: &str,
        slot: u64,
        timestamp: i64,
    ) -> String {
        use base64::engine::general_purpose::STANDARD;
        use base64::Engine;
        use sha2::{Digest, Sha256};

        let disc = {
            let hash = Sha256::digest(b"event:ProofSettled");
            let mut d = [0u8; 8];
            d.copy_from_slice(&hash[..8]);
            d
        };
        let mut buf = Vec::new();
        buf.extend_from_slice(&disc);
        buf.extend_from_slice(&borsh::to_vec(event).unwrap());
        let b64 = STANDARD.encode(&buf);

        serde_json::to_string(&serde_json::json!([{
            "signature": signature,
            "slot": slot,
            "timestamp": timestamp,
            "logMessages": [format!("Program data: {b64}")]
        }]))
        .unwrap()
    }

    fn test_event() -> zksettle_types::ProofSettled {
        zksettle_types::ProofSettled {
            issuer: [1u8; 32],
            nullifier_hash: [9u8; 32],
            merkle_root: [3u8; 32],
            sanctions_root: [4u8; 32],
            jurisdiction_root: [5u8; 32],
            mint: [6u8; 32],
            recipient: [7u8; 32],
            amount: 1_000_000,
            epoch: 3,
            timestamp: 1_700_000_000,
            slot: 500,
            payer: [8u8; 32],
        }
    }

    #[tokio::test]
    #[serial]
    async fn webhook_stores_event_in_db() {
        let (app, _tmp, state) = test_app_with_db().await;
        let db = state.db.as_ref().unwrap();
        let ev = test_event();
        let body = make_webhook_payload(&ev, "txSig1", 500, 1_700_000_000);

        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/helius")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer test-token")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);

        let nh = hex::encode(ev.nullifier_hash);
        let row = event::Entity::find()
            .filter(event::Column::NullifierHash.eq(&nh))
            .one(db)
            .await
            .unwrap()
            .expect("event should be stored in DB");

        assert_eq!(row.signature, "txSig1");
        assert_eq!(row.slot, 500);
        assert_eq!(row.issuer, bs58::encode(ev.issuer).into_string());
        assert_eq!(row.recipient, bs58::encode(ev.recipient).into_string());
        assert_eq!(row.nullifier_hash, nh);
        assert_eq!(row.merkle_root, hex::encode(ev.merkle_root));
        assert_eq!(row.amount, 1_000_000);
        assert_eq!(row.epoch, 3);
    }

    #[tokio::test]
    #[serial]
    async fn webhook_duplicate_nullifier_no_db_insert() {
        let (app, _tmp, state) = test_app_with_db().await;
        let db = state.db.as_ref().unwrap();
        let ev = test_event();
        let body = make_webhook_payload(&ev, "txDup1", 500, 1_700_000_000);

        // First
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/helius")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer test-token")
                    .body(Body::from(body.clone()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);

        // Duplicate
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/helius")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer test-token")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), 200);

        let nh = hex::encode(ev.nullifier_hash);
        let rows = event::Entity::find()
            .filter(event::Column::NullifierHash.eq(&nh))
            .all(db)
            .await
            .unwrap();
        assert_eq!(rows.len(), 1, "dedup should block second insert");
    }
}
