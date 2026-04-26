use sea_orm::*;
use sha2::{Digest, Sha256};
use zksettle_types::gateway::{ApiKeyRecord, Tier};

use crate::entity::api_key;
use crate::error::GatewayError;

fn model_to_record(m: api_key::Model) -> Result<ApiKeyRecord, GatewayError> {
    let tier: Tier = m
        .tier
        .parse()
        .map_err(|e: String| GatewayError::Database(e))?;
    Ok(ApiKeyRecord {
        key_hash: m.key_hash,
        tier,
        owner: m.owner,
        created_at: m.created_at as u64,
    })
}

pub async fn insert(
    db: &DatabaseConnection,
    raw_key: &str,
    owner: String,
    tier: Tier,
    created_at: u64,
) -> Result<(), GatewayError> {
    let hash = hash_key(raw_key);
    let model = api_key::ActiveModel {
        key_hash: Set(hash),
        owner: Set(owner),
        tier: Set(tier.to_string()),
        created_at: Set(created_at as i64),
    };
    api_key::Entity::insert(model).exec(db).await?;
    Ok(())
}

pub async fn lookup_by_hash(
    db: &DatabaseConnection,
    key_hash: &str,
) -> Result<Option<ApiKeyRecord>, GatewayError> {
    let result = api_key::Entity::find_by_id(key_hash).one(db).await?;
    result.map(model_to_record).transpose()
}

pub async fn remove_by_hash(
    db: &DatabaseConnection,
    key_hash: &str,
) -> Result<bool, GatewayError> {
    let result = api_key::Entity::delete_by_id(key_hash).exec(db).await?;
    Ok(result.rows_affected > 0)
}

pub async fn list(db: &DatabaseConnection) -> Result<Vec<ApiKeyRecord>, GatewayError> {
    let results = api_key::Entity::find().all(db).await?;
    results.into_iter().map(model_to_record).collect()
}

pub fn hash_key(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn generate_key() -> String {
    use rand::Rng;
    let bytes: [u8; 32] = rand::rng().random();
    format!("zks_{}", hex::encode(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{test_cleanup, test_db};
    use serial_test::serial;

    #[tokio::test]
    #[serial]
    async fn insert_and_lookup() {
        let db = test_db().await;
        test_cleanup(&db).await;
        insert(&db, "test-key", "alice".into(), Tier::Developer, 1000)
            .await
            .unwrap();
        let record = lookup_by_hash(&db, &hash_key("test-key"))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(record.owner, "alice");
        assert_eq!(record.tier, Tier::Developer);
    }

    #[tokio::test]
    #[serial]
    async fn lookup_missing_returns_none() {
        let db = test_db().await;
        test_cleanup(&db).await;
        assert!(lookup_by_hash(&db, &hash_key("nonexistent"))
            .await
            .unwrap()
            .is_none());
    }

    #[tokio::test]
    #[serial]
    async fn remove_key() {
        let db = test_db().await;
        test_cleanup(&db).await;
        insert(&db, "key", "bob".into(), Tier::Startup, 2000)
            .await
            .unwrap();
        let hash = hash_key("key");
        assert!(remove_by_hash(&db, &hash).await.unwrap());
        assert!(lookup_by_hash(&db, &hash).await.unwrap().is_none());
    }

    #[tokio::test]
    #[serial]
    async fn remove_by_hash_returns_false_when_unknown() {
        let db = test_db().await;
        test_cleanup(&db).await;
        assert!(!remove_by_hash(&db, &"0".repeat(64)).await.unwrap());
    }

    #[tokio::test]
    #[serial]
    async fn list_returns_all_records() {
        let db = test_db().await;
        test_cleanup(&db).await;
        insert(&db, "a", "alice".into(), Tier::Developer, 100)
            .await
            .unwrap();
        insert(&db, "b", "bob".into(), Tier::Startup, 200)
            .await
            .unwrap();
        let mut owners: Vec<String> = list(&db)
            .await
            .unwrap()
            .into_iter()
            .map(|r| r.owner)
            .collect();
        owners.sort();
        assert_eq!(owners, vec!["alice".to_string(), "bob".to_string()]);
    }

    #[tokio::test]
    #[serial]
    async fn insert_duplicate_key_hash_errors() {
        let db = test_db().await;
        test_cleanup(&db).await;
        insert(&db, "dup", "alice".into(), Tier::Developer, 100)
            .await
            .unwrap();
        let result = insert(&db, "dup", "bob".into(), Tier::Developer, 200).await;
        assert!(result.is_err());
    }

    #[test]
    fn generated_key_has_prefix() {
        let key = generate_key();
        assert!(key.starts_with("zks_"));
        assert_eq!(key.len(), 4 + 64);
    }

    #[test]
    fn hash_is_deterministic() {
        assert_eq!(hash_key("abc"), hash_key("abc"));
        assert_ne!(hash_key("abc"), hash_key("def"));
    }
}
