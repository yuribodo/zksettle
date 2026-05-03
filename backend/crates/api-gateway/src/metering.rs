use sea_orm::prelude::Expr;
use sea_orm::*;
use zksettle_types::gateway::{DailyUsage, UsageRecord};

use crate::entity::{daily_usage, usage_record};
use crate::error::GatewayError;

const PERIOD_SECS: u64 = 30 * 24 * 60 * 60;
const DAY_SECS: u64 = 24 * 60 * 60;
const MAX_DAILY_BUCKETS: u64 = 400;

/// Unconditionally increment usage (no limit check). Used only in tests to seed data.
#[cfg(test)]
pub async fn increment(
    db: &DatabaseConnection,
    key_hash: &str,
    now: u64,
) -> Result<(), GatewayError> {
    let now_i = now as i64;
    let period = PERIOD_SECS as i64;

    db.execute(Statement::from_sql_and_values(
        DbBackend::Postgres,
        r#"INSERT INTO usage_records (key_hash, request_count, period_start, last_request)
           VALUES ($1, 1, $2, $2)
           ON CONFLICT (key_hash) DO UPDATE SET
             request_count = CASE
               WHEN $2 - usage_records.period_start >= $3 THEN 1
               ELSE usage_records.request_count + 1
             END,
             period_start = CASE
               WHEN $2 - usage_records.period_start >= $3 THEN $2
               ELSE usage_records.period_start
             END,
             last_request = $2"#,
        [key_hash.into(), now_i.into(), period.into()],
    ))
    .await?;

    record_daily(db, key_hash, now).await?;
    Ok(())
}

/// Atomically reserve one request against the quota. Returns `true` if
/// the reservation succeeded (count was strictly below `limit`), `false`
/// if quota is exhausted. Allows exactly `limit` total requests per period.
/// Handles period rollover.
pub async fn try_reserve(
    db: &DatabaseConnection,
    key_hash: &str,
    now: u64,
    limit: u64,
) -> Result<bool, GatewayError> {
    let now_i = now as i64;
    let period = PERIOD_SECS as i64;
    let limit_i = limit as i64;

    let result = db.execute(Statement::from_sql_and_values(
        DbBackend::Postgres,
        r#"INSERT INTO usage_records (key_hash, request_count, period_start, last_request)
           VALUES ($1, 1, $2, $2)
           ON CONFLICT (key_hash) DO UPDATE SET
             request_count = CASE
               WHEN $2 - usage_records.period_start >= $3 THEN 1
               ELSE usage_records.request_count + 1
             END,
             period_start = CASE
               WHEN $2 - usage_records.period_start >= $3 THEN $2
               ELSE usage_records.period_start
             END,
             last_request = $2
           WHERE $2 - usage_records.period_start >= $3
              OR usage_records.request_count < $4"#,
        [key_hash.into(), now_i.into(), period.into(), limit_i.into()],
    ))
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn release(
    db: &DatabaseConnection,
    key_hash: &str,
) -> Result<(), GatewayError> {
    usage_record::Entity::update_many()
        .col_expr(
            usage_record::Column::RequestCount,
            Expr::cust("GREATEST(request_count - 1, 0)"),
        )
        .filter(usage_record::Column::KeyHash.eq(key_hash))
        .exec(db)
        .await?;
    Ok(())
}

pub async fn record_daily(
    db: &DatabaseConnection,
    key_hash: &str,
    now: u64,
) -> Result<(), GatewayError> {
    let day = day_start(now) as i64;

    let row = daily_usage::ActiveModel {
        key_hash: Set(key_hash.to_owned()),
        day_start: Set(day),
        count: Set(1),
    };

    daily_usage::Entity::insert(row)
        .on_conflict(
            sea_query::OnConflict::columns([
                daily_usage::Column::KeyHash,
                daily_usage::Column::DayStart,
            ])
            .value(
                daily_usage::Column::Count,
                Expr::col(daily_usage::Column::Count).add(1),
            )
            .to_owned(),
        )
        .exec(db)
        .await?;

    prune_old_buckets(db, key_hash, now).await?;

    Ok(())
}

pub async fn get(
    db: &DatabaseConnection,
    key_hash: &str,
    now: u64,
) -> Result<UsageRecord, GatewayError> {
    let result = usage_record::Entity::find_by_id(key_hash).one(db).await?;
    match result {
        Some(rec) => {
            if now as i64 - rec.period_start >= PERIOD_SECS as i64 {
                Ok(UsageRecord::new(now))
            } else {
                Ok(UsageRecord {
                    request_count: rec.request_count as u64,
                    period_start: rec.period_start as u64,
                    last_request: rec.last_request as u64,
                })
            }
        }
        None => Ok(UsageRecord::new(now)),
    }
}

pub async fn current_count(
    db: &DatabaseConnection,
    key_hash: &str,
    now: u64,
) -> Result<u64, GatewayError> {
    Ok(get(db, key_hash, now).await?.request_count)
}

pub async fn daily_history(
    db: &DatabaseConnection,
    key_hash: &str,
    now: u64,
    days: u32,
) -> Result<Vec<DailyUsage>, GatewayError> {
    if days == 0 {
        return Ok(Vec::new());
    }
    let today = day_start(now);

    let cutoff = today.saturating_sub((days as u64 - 1) * DAY_SECS) as i64;

    let rows = daily_usage::Entity::find()
        .filter(daily_usage::Column::KeyHash.eq(key_hash))
        .filter(daily_usage::Column::DayStart.gte(cutoff))
        .all(db)
        .await?;

    let counts: std::collections::BTreeMap<i64, i64> =
        rows.into_iter().map(|r| (r.day_start, r.count)).collect();

    let mut out = Vec::with_capacity(days as usize);
    for offset in (0..days as u64).rev() {
        let day = today.saturating_sub(offset * DAY_SECS);
        let count = counts.get(&(day as i64)).copied().unwrap_or(0);
        out.push(DailyUsage {
            date: format_day(day),
            count: count as u64,
        });
    }
    Ok(out)
}

async fn prune_old_buckets(
    db: &DatabaseConnection,
    key_hash: &str,
    now: u64,
) -> Result<(), GatewayError> {
    let cutoff = (now.saturating_sub((MAX_DAILY_BUCKETS - 1) * DAY_SECS)) as i64;

    daily_usage::Entity::delete_many()
        .filter(daily_usage::Column::KeyHash.eq(key_hash))
        .filter(daily_usage::Column::DayStart.lt(cutoff))
        .exec(db)
        .await?;

    Ok(())
}

fn day_start(unix_secs: u64) -> u64 {
    (unix_secs / DAY_SECS) * DAY_SECS
}

fn format_day(day_start_unix: u64) -> String {
    let days_since_epoch = (day_start_unix / DAY_SECS) as i64;
    let (y, m, d) = civil_from_days(days_since_epoch);
    format!("{y:04}-{m:02}-{d:02}")
}

fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp.wrapping_sub(9) };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::key_store;
    use crate::{test_cleanup, test_db};
    use serial_test::serial;

    async fn seed_key(db: &DatabaseConnection, raw: &str) -> String {
        key_store::insert(db, raw, "test-owner".into(), zksettle_types::gateway::Tier::Developer, 0, None)
            .await
            .unwrap();
        key_store::hash_key(raw)
    }

    #[tokio::test]
    #[serial]
    async fn increment_from_zero() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-k1").await;
        increment(&db, &kh, 1000).await.unwrap();
        assert_eq!(current_count(&db, &kh, 1000).await.unwrap(), 1);
    }

    #[tokio::test]
    #[serial]
    async fn increment_accumulates() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-k2").await;
        increment(&db, &kh, 1000).await.unwrap();
        increment(&db, &kh, 1001).await.unwrap();
        increment(&db, &kh, 1002).await.unwrap();
        assert_eq!(current_count(&db, &kh, 1002).await.unwrap(), 3);
    }

    #[tokio::test]
    #[serial]
    async fn period_rollover_resets_count() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-k3").await;
        increment(&db, &kh, 1000).await.unwrap();
        increment(&db, &kh, 1001).await.unwrap();
        let after_period = 1000 + PERIOD_SECS + 1;
        increment(&db, &kh, after_period).await.unwrap();
        assert_eq!(current_count(&db, &kh, after_period).await.unwrap(), 1);
    }

    #[tokio::test]
    #[serial]
    async fn get_unknown_key_returns_zero() {
        let db = test_db().await;
        test_cleanup(&db).await;
        assert_eq!(current_count(&db, "unknown", 5000).await.unwrap(), 0);
    }

    #[tokio::test]
    #[serial]
    async fn period_boundary_exact() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-k4").await;
        increment(&db, &kh, 0).await.unwrap();
        let exactly_at = PERIOD_SECS;
        increment(&db, &kh, exactly_at).await.unwrap();
        assert_eq!(current_count(&db, &kh, exactly_at).await.unwrap(), 1);
    }

    #[tokio::test]
    #[serial]
    async fn period_boundary_one_before() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-k5").await;
        increment(&db, &kh, 0).await.unwrap();
        let just_before = PERIOD_SECS - 1;
        increment(&db, &kh, just_before).await.unwrap();
        assert_eq!(current_count(&db, &kh, just_before).await.unwrap(), 2);
    }

    #[tokio::test]
    #[serial]
    async fn get_returns_fresh_record_after_period() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-k6").await;
        increment(&db, &kh, 0).await.unwrap();
        increment(&db, &kh, 1).await.unwrap();
        let after = PERIOD_SECS + 100;
        let rec = get(&db, &kh, after).await.unwrap();
        assert_eq!(rec.request_count, 0);
        assert_eq!(rec.period_start, after);
    }

    #[tokio::test]
    #[serial]
    async fn last_request_updated() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-k7").await;
        increment(&db, &kh, 100).await.unwrap();
        increment(&db, &kh, 200).await.unwrap();
        let rec = get(&db, &kh, 200).await.unwrap();
        assert_eq!(rec.last_request, 200);
    }

    #[test]
    fn period_secs_is_30_days() {
        assert_eq!(PERIOD_SECS, 30 * 24 * 60 * 60);
    }

    #[tokio::test]
    #[serial]
    async fn daily_history_empty_for_unknown_key() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let h = daily_history(&db, "nope", DAY_SECS * 100, 7).await.unwrap();
        assert_eq!(h.len(), 7);
        assert!(h.iter().all(|d| d.count == 0));
    }

    #[tokio::test]
    #[serial]
    async fn daily_history_zero_days_returns_empty() {
        let db = test_db().await;
        assert!(daily_history(&db, "k", 0, 0).await.unwrap().is_empty());
    }

    #[tokio::test]
    #[serial]
    async fn daily_history_groups_same_day() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-daily1").await;
        let now = DAY_SECS * 100 + 42;
        increment(&db, &kh, now).await.unwrap();
        increment(&db, &kh, now + 10).await.unwrap();
        increment(&db, &kh, now + 999).await.unwrap();
        let h = daily_history(&db, &kh, now, 1).await.unwrap();
        assert_eq!(h.len(), 1);
        assert_eq!(h[0].count, 3);
    }

    #[tokio::test]
    #[serial]
    async fn daily_history_separates_consecutive_days() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-daily2").await;
        let day0 = DAY_SECS * 200;
        increment(&db, &kh, day0).await.unwrap();
        increment(&db, &kh, day0 + DAY_SECS).await.unwrap();
        increment(&db, &kh, day0 + DAY_SECS).await.unwrap();
        let h = daily_history(&db, &kh, day0 + DAY_SECS, 2).await.unwrap();
        assert_eq!(h[0].count, 1);
        assert_eq!(h[1].count, 2);
    }

    #[tokio::test]
    #[serial]
    async fn daily_history_zero_fills_gaps() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-daily3").await;
        let day0 = DAY_SECS * 300;
        increment(&db, &kh, day0).await.unwrap();
        let h = daily_history(&db, &kh, day0 + 3 * DAY_SECS, 5).await.unwrap();
        assert_eq!(h.len(), 5);
        let counts: Vec<u64> = h.iter().map(|d| d.count).collect();
        assert_eq!(counts, vec![0, 1, 0, 0, 0]);
    }

    #[tokio::test]
    #[serial]
    async fn daily_history_dates_are_iso() {
        let db = test_db().await;
        let h = daily_history(&db, "k", 0, 1).await.unwrap();
        assert_eq!(h[0].date, "1970-01-01");
        let h = daily_history(&db, "k", 1_777_075_200, 1).await.unwrap();
        assert_eq!(h[0].date, "2026-04-25");
    }

    #[test]
    fn day_start_truncates_to_midnight_utc() {
        assert_eq!(day_start(DAY_SECS + 5), DAY_SECS);
        assert_eq!(day_start(DAY_SECS - 1), 0);
        assert_eq!(day_start(DAY_SECS), DAY_SECS);
    }

    #[tokio::test]
    #[serial]
    async fn pruning_caps_stored_buckets() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "meter-prune").await;
        for i in 0..(MAX_DAILY_BUCKETS + 5) {
            increment(&db, &kh, i * DAY_SECS).await.unwrap();
        }
        let stored = daily_usage::Entity::find()
            .filter(daily_usage::Column::KeyHash.eq(kh.as_str()))
            .count(&db)
            .await
            .unwrap();
        assert_eq!(stored, MAX_DAILY_BUCKETS);
    }

    #[test]
    fn civil_from_days_known_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(31), (1970, 2, 1));
        assert_eq!(civil_from_days(365), (1971, 1, 1));
        assert_eq!(civil_from_days(20_454), (2026, 1, 1));
        assert_eq!(civil_from_days(20_568), (2026, 4, 25));
        assert_eq!(civil_from_days(47_541), (2100, 3, 1));
        assert_eq!(civil_from_days(-25_508), (1900, 3, 1));
        assert_eq!(civil_from_days(11_016), (2000, 2, 29));
        assert_eq!(civil_from_days(-719_468), (0, 3, 1));
        assert_eq!(civil_from_days(-719_469), (0, 2, 29));
    }

    #[tokio::test]
    #[serial]
    async fn try_reserve_under_limit_succeeds() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "reserve-k1").await;
        assert!(try_reserve(&db, &kh, 1000, 5).await.unwrap());
        assert_eq!(current_count(&db, &kh, 1000).await.unwrap(), 1);
    }

    #[tokio::test]
    #[serial]
    async fn try_reserve_at_limit_fails() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "reserve-k2").await;
        for i in 0..3 {
            assert!(try_reserve(&db, &kh, 1000 + i, 3).await.unwrap());
        }
        assert_eq!(current_count(&db, &kh, 1003).await.unwrap(), 3);
        assert!(!try_reserve(&db, &kh, 1004, 3).await.unwrap());
        assert_eq!(current_count(&db, &kh, 1004).await.unwrap(), 3);
    }

    #[tokio::test]
    #[serial]
    async fn try_reserve_period_rollover_resets() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "reserve-k3").await;
        for i in 0..3 {
            try_reserve(&db, &kh, 1000 + i, 3).await.unwrap();
        }
        assert!(!try_reserve(&db, &kh, 1004, 3).await.unwrap());
        let after_period = 1000 + PERIOD_SECS + 1;
        assert!(try_reserve(&db, &kh, after_period, 3).await.unwrap());
        assert_eq!(current_count(&db, &kh, after_period).await.unwrap(), 1);
    }

    #[tokio::test]
    #[serial]
    async fn release_decrements() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "release-k1").await;
        try_reserve(&db, &kh, 1000, 10).await.unwrap();
        try_reserve(&db, &kh, 1001, 10).await.unwrap();
        assert_eq!(current_count(&db, &kh, 1001).await.unwrap(), 2);
        release(&db, &kh).await.unwrap();
        assert_eq!(current_count(&db, &kh, 1001).await.unwrap(), 1);
    }

    #[tokio::test]
    #[serial]
    async fn release_at_zero_stays_at_zero() {
        let db = test_db().await;
        test_cleanup(&db).await;
        let kh = seed_key(&db, "release-k2").await;
        try_reserve(&db, &kh, 1000, 10).await.unwrap();
        release(&db, &kh).await.unwrap();
        assert_eq!(current_count(&db, &kh, 1000).await.unwrap(), 0);
        release(&db, &kh).await.unwrap();
        assert_eq!(current_count(&db, &kh, 1000).await.unwrap(), 0);
    }
}
