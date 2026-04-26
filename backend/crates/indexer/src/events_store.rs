//! Append-only RocksDB store for `ProofSettled` events that lets the
//! dashboard's audit log query historical events by descending slot order.
//!
//! Key layout: `slot_be(8)` + `signature_bytes` — sorts chronologically
//! ascending. Reverse-iterate to yield newest first. Same `(slot, signature)`
//! pair overwrites the previous value (idempotent re-inserts).

use std::path::Path;
use std::sync::Arc;

use borsh::{BorshDeserialize, BorshSerialize};
use rocksdb::{Direction, IteratorMode, Options, DB};

use crate::error::IndexerError;

/// Persisted shape — borsh on disk; converted to a hex-string wire shape for
/// the HTTP API.
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, PartialEq, Eq)]
pub struct StoredEvent {
    pub signature: String,
    pub slot: u64,
    pub timestamp: u64,
    pub issuer: [u8; 32],
    pub nullifier_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub sanctions_root: [u8; 32],
    pub jurisdiction_root: [u8; 32],
    pub mint: [u8; 32],
    pub recipient: [u8; 32],
    pub payer: [u8; 32],
    pub amount: u64,
    pub epoch: u64,
}

#[derive(Clone)]
pub struct EventStore {
    db: Arc<DB>,
}

impl EventStore {
    #[mutants::skip]
    pub fn open(path: &Path) -> Result<Self, IndexerError> {
        let mut opts = Options::default();
        opts.create_if_missing(true);
        opts.set_compression_type(rocksdb::DBCompressionType::Lz4);
        let db = DB::open(&opts, path).map_err(|e| {
            IndexerError::Config(format!(
                "failed to open events database at {}: {e}",
                path.display()
            ))
        })?;
        Ok(Self { db: Arc::new(db) })
    }

    /// Store an event. Re-insert with the same `(slot, signature)` is a no-op
    /// on the listing (overwrites the row).
    pub fn insert(&self, evt: &StoredEvent) -> Result<(), IndexerError> {
        let key = encode_key(evt.slot, &evt.signature);
        let value = borsh::to_vec(evt).map_err(|e| {
            IndexerError::DedupWrite(format!("failed to encode event: {e}"))
        })?;
        self.db
            .put(key, value)
            .map_err(|e| IndexerError::DedupWrite(format!("failed to persist event: {e}")))
    }

    /// Returns up to `limit` events with `(slot, signature) < cursor` (or the
    /// newest events when cursor is `None`). Newest first.
    /// Second tuple field is the cursor for the *next* page (`None` when
    /// fewer than `limit` events were returned, i.e. caller has reached the end).
    pub fn list(
        &self,
        cursor: Option<Cursor>,
        limit: usize,
    ) -> Result<(Vec<StoredEvent>, Option<Cursor>), IndexerError> {
        self.list_filtered(cursor, limit, &EventFilter::default())
    }

    /// Same as `list`, but also applies a post-deserialize filter. Pagination
    /// remains correct (cursor is `(slot, signature)` of the last *returned*
    /// event, so the next call resumes scanning past it). For very selective
    /// filters this can scan a lot of rows — fine for the audit-log MVP, but
    /// production should add secondary indexes (issuer→keys, etc).
    pub fn list_filtered(
        &self,
        cursor: Option<Cursor>,
        limit: usize,
        filter: &EventFilter,
    ) -> Result<(Vec<StoredEvent>, Option<Cursor>), IndexerError> {
        if limit == 0 {
            return Ok((Vec::new(), None));
        }

        // Hoist the seek key out of the match so its borrow outlives the
        // iterator construction below.
        let seek_key: Option<Vec<u8>> = match cursor.as_ref() {
            None => None,
            Some(c) => {
                let mut k = encode_key(c.slot, &c.signature);
                // Decrement by 1 so the cursored row itself is excluded when
                // reverse-iterating with `From(.., Reverse)`.
                if !decrement_key_in_place(&mut k) {
                    return Ok((Vec::new(), None));
                }
                Some(k)
            }
        };
        let iter_mode = match seek_key.as_deref() {
            None => IteratorMode::End,
            Some(k) => IteratorMode::From(k, Direction::Reverse),
        };

        let mut out = Vec::with_capacity(limit);
        let mut last: Option<Cursor> = None;
        for item in self.db.iterator(iter_mode) {
            let (key, value) = item.map_err(|e| {
                IndexerError::Config(format!("events db read failed: {e}"))
            })?;
            if !key.starts_with(&[]) || key.len() < 8 {
                continue;
            }
            let evt = StoredEvent::try_from_slice(&value).map_err(|e| {
                IndexerError::Config(format!("events db corrupt: {e}"))
            })?;
            if !filter.matches(&evt) {
                continue;
            }
            last = Some(Cursor {
                slot: evt.slot,
                signature: evt.signature.clone(),
            });
            out.push(evt);
            if out.len() >= limit {
                break;
            }
        }

        let next = if out.len() == limit { last } else { None };
        Ok((out, next))
    }
}

/// Optional post-deserialize filters for `EventStore::list_filtered`.
/// `from_ts` inclusive, `to_ts` exclusive (`[from_ts, to_ts)`).
#[derive(Default, Debug, Clone)]
pub struct EventFilter {
    pub from_ts: Option<u64>,
    pub to_ts: Option<u64>,
    pub issuer: Option<[u8; 32]>,
    pub recipient: Option<[u8; 32]>,
}

impl EventFilter {
    pub fn is_empty(&self) -> bool {
        self.from_ts.is_none()
            && self.to_ts.is_none()
            && self.issuer.is_none()
            && self.recipient.is_none()
    }

    pub fn matches(&self, evt: &StoredEvent) -> bool {
        if let Some(from) = self.from_ts {
            if evt.timestamp < from {
                return false;
            }
        }
        if let Some(to) = self.to_ts {
            if evt.timestamp >= to {
                return false;
            }
        }
        if let Some(ref issuer) = self.issuer {
            if &evt.issuer != issuer {
                return false;
            }
        }
        if let Some(ref recipient) = self.recipient {
            if &evt.recipient != recipient {
                return false;
            }
        }
        true
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cursor {
    pub slot: u64,
    pub signature: String,
}

impl Cursor {
    /// Encode as URL-safe base64 of `slot_be(8) + signature_bytes`.
    pub fn to_token(&self) -> String {
        use base64::engine::general_purpose::URL_SAFE_NO_PAD;
        use base64::Engine;
        let key = encode_key(self.slot, &self.signature);
        URL_SAFE_NO_PAD.encode(key)
    }

    pub fn from_token(token: &str) -> Result<Self, &'static str> {
        use base64::engine::general_purpose::URL_SAFE_NO_PAD;
        use base64::Engine;
        let raw = URL_SAFE_NO_PAD.decode(token).map_err(|_| "invalid cursor")?;
        if raw.len() < 8 {
            return Err("invalid cursor");
        }
        let mut slot_bytes = [0u8; 8];
        slot_bytes.copy_from_slice(&raw[..8]);
        let slot = u64::from_be_bytes(slot_bytes);
        let signature = std::str::from_utf8(&raw[8..])
            .map_err(|_| "invalid cursor")?
            .to_string();
        Ok(Cursor { slot, signature })
    }
}

fn encode_key(slot: u64, signature: &str) -> Vec<u8> {
    let mut k = Vec::with_capacity(8 + signature.len());
    k.extend_from_slice(&slot.to_be_bytes());
    k.extend_from_slice(signature.as_bytes());
    k
}

/// Subtract 1 from a big-endian byte string, in place. Returns `false` on
/// underflow (input was all zeros).
fn decrement_key_in_place(key: &mut [u8]) -> bool {
    for byte in key.iter_mut().rev() {
        if *byte > 0 {
            *byte -= 1;
            return true;
        }
        *byte = 0xff;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(slot: u64, sig: &str) -> StoredEvent {
        StoredEvent {
            signature: sig.into(),
            slot,
            timestamp: slot * 100,
            issuer: [1u8; 32],
            nullifier_hash: {
                let mut h = [0u8; 32];
                h[..8].copy_from_slice(&slot.to_be_bytes());
                h
            },
            merkle_root: [3u8; 32],
            sanctions_root: [4u8; 32],
            jurisdiction_root: [5u8; 32],
            mint: [6u8; 32],
            recipient: [7u8; 32],
            payer: [8u8; 32],
            amount: 1_000_000 * slot,
            epoch: slot / 100,
        }
    }

    fn open() -> (EventStore, tempfile::TempDir) {
        let tmp = tempfile::tempdir().unwrap();
        let store = EventStore::open(tmp.path()).unwrap();
        (store, tmp)
    }

    #[test]
    fn insert_then_list_returns_newest_first() {
        let (store, _tmp) = open();
        store.insert(&fixture(100, "sig-a")).unwrap();
        store.insert(&fixture(200, "sig-b")).unwrap();
        store.insert(&fixture(150, "sig-c")).unwrap();

        let (events, next) = store.list(None, 10).unwrap();
        let slots: Vec<u64> = events.iter().map(|e| e.slot).collect();
        assert_eq!(slots, vec![200, 150, 100]);
        assert_eq!(next, None, "cursor should be None when list shorter than limit");
    }

    #[test]
    fn list_with_zero_limit_returns_empty() {
        let (store, _tmp) = open();
        store.insert(&fixture(1, "s")).unwrap();
        let (events, next) = store.list(None, 0).unwrap();
        assert!(events.is_empty());
        assert!(next.is_none());
    }

    #[test]
    fn cursor_pagination_yields_each_event_exactly_once() {
        let (store, _tmp) = open();
        for slot in 1..=7u64 {
            store.insert(&fixture(slot, &format!("sig-{slot}"))).unwrap();
        }

        let mut all_slots: Vec<u64> = Vec::new();
        let mut cursor: Option<Cursor> = None;
        loop {
            let (events, next) = store.list(cursor.clone(), 3).unwrap();
            for e in &events {
                all_slots.push(e.slot);
            }
            if next.is_none() {
                break;
            }
            cursor = next;
        }
        assert_eq!(all_slots, vec![7, 6, 5, 4, 3, 2, 1]);
    }

    #[test]
    fn same_slot_different_signatures_both_kept() {
        let (store, _tmp) = open();
        store.insert(&fixture(50, "alpha")).unwrap();
        store.insert(&fixture(50, "beta")).unwrap();
        let (events, _) = store.list(None, 10).unwrap();
        assert_eq!(events.len(), 2);
        // Tiebreak by signature (lexicographic via byte order):
        // newest-first → "beta" before "alpha".
        assert_eq!(events[0].signature, "beta");
        assert_eq!(events[1].signature, "alpha");
    }

    #[test]
    fn reinsert_same_key_overwrites() {
        let (store, _tmp) = open();
        store.insert(&fixture(10, "x")).unwrap();
        let mut updated = fixture(10, "x");
        updated.amount = 99_999;
        store.insert(&updated).unwrap();
        let (events, _) = store.list(None, 10).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].amount, 99_999);
    }

    #[test]
    fn cursor_token_roundtrip() {
        let c = Cursor {
            slot: 12_345,
            signature: "abcDEF123".into(),
        };
        let token = c.to_token();
        let parsed = Cursor::from_token(&token).unwrap();
        assert_eq!(parsed, c);
    }

    #[test]
    fn cursor_from_invalid_token_errors() {
        assert!(Cursor::from_token("not_base64!!!").is_err());
        assert!(Cursor::from_token("AA").is_err()); // too short for slot
    }

    #[test]
    fn decrement_key_underflow_returns_false() {
        let mut k = vec![0u8; 8];
        assert!(!decrement_key_in_place(&mut k));
    }

    #[test]
    fn filter_default_matches_everything() {
        let f = EventFilter::default();
        assert!(f.is_empty());
        assert!(f.matches(&fixture(1, "x")));
    }

    #[test]
    fn filter_by_timestamp_range() {
        let evt = fixture(50, "x"); // timestamp = 50 * 100 = 5_000
        let f_in = EventFilter {
            from_ts: Some(4_000),
            to_ts: Some(6_000),
            ..Default::default()
        };
        assert!(f_in.matches(&evt));

        let f_too_old = EventFilter {
            from_ts: Some(6_000),
            ..Default::default()
        };
        assert!(!f_too_old.matches(&evt));

        let f_too_new = EventFilter {
            to_ts: Some(5_000), // exclusive
            ..Default::default()
        };
        assert!(!f_too_new.matches(&evt), "to_ts must be exclusive");

        let f_at_from = EventFilter {
            from_ts: Some(5_000), // inclusive
            ..Default::default()
        };
        assert!(f_at_from.matches(&evt), "from_ts must be inclusive");
    }

    #[test]
    fn filter_by_issuer() {
        let evt = fixture(1, "x");
        let f = EventFilter {
            issuer: Some([1u8; 32]),
            ..Default::default()
        };
        assert!(f.matches(&evt));
        let f_other = EventFilter {
            issuer: Some([99u8; 32]),
            ..Default::default()
        };
        assert!(!f_other.matches(&evt));
    }

    #[test]
    fn filter_by_recipient() {
        let evt = fixture(1, "x"); // recipient = [7u8; 32]
        let f = EventFilter {
            recipient: Some([7u8; 32]),
            ..Default::default()
        };
        assert!(f.matches(&evt));
        let f_other = EventFilter {
            recipient: Some([0u8; 32]),
            ..Default::default()
        };
        assert!(!f_other.matches(&evt));
    }

    #[test]
    fn list_filtered_paginates_correctly_through_filtered_results() {
        let (store, _tmp) = open();
        // Insert 6 events: alternating issuer ([1u8;32] vs [9u8;32]).
        // fixture() uses [1u8;32] always, so build manually.
        for slot in 1..=6u64 {
            let mut e = fixture(slot, &format!("sig-{slot}"));
            if slot % 2 == 0 {
                e.issuer = [9u8; 32];
            }
            store.insert(&e).unwrap();
        }

        let filter = EventFilter {
            issuer: Some([1u8; 32]),
            ..Default::default()
        };

        // 3 odd-slot events match. Page through them in pairs.
        let (page1, next) = store.list_filtered(None, 2, &filter).unwrap();
        assert_eq!(page1.iter().map(|e| e.slot).collect::<Vec<_>>(), vec![5, 3]);
        assert!(next.is_some());

        let (page2, next) = store.list_filtered(next, 2, &filter).unwrap();
        assert_eq!(page2.iter().map(|e| e.slot).collect::<Vec<_>>(), vec![1]);
        assert!(next.is_none(), "fewer than limit returned → no more pages");
    }

    #[test]
    fn decrement_key_carries_through_zeros() {
        let mut k = vec![0x01u8, 0x00, 0x00];
        assert!(decrement_key_in_place(&mut k));
        assert_eq!(k, vec![0x00u8, 0xff, 0xff]);
    }
}
