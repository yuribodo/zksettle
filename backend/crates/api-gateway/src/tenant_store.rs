use sea_orm::*;
use uuid::Uuid;

use crate::entity::tenant;
use crate::error::GatewayError;

pub async fn find_by_wallet(
    db: &DatabaseConnection,
    wallet: &str,
) -> Result<Option<tenant::Model>, GatewayError> {
    tenant::Entity::find()
        .filter(tenant::Column::Wallet.eq(wallet))
        .one(db)
        .await
        .map_err(Into::into)
}

pub async fn find_by_id(
    db: &DatabaseConnection,
    id: Uuid,
) -> Result<Option<tenant::Model>, GatewayError> {
    tenant::Entity::find_by_id(id)
        .one(db)
        .await
        .map_err(Into::into)
}

pub async fn find_or_create(
    db: &DatabaseConnection,
    wallet: &str,
    now: u64,
) -> Result<tenant::Model, GatewayError> {
    if let Some(existing) = find_by_wallet(db, wallet).await? {
        return Ok(existing);
    }

    let model = tenant::ActiveModel {
        id: Set(Uuid::new_v4()),
        wallet: Set(wallet.to_owned()),
        name: Set(None),
        tier: Set("developer".to_owned()),
        created_at: Set(now as i64),
    };

    tenant::Entity::insert(model)
        .on_conflict(
            sea_orm::sea_query::OnConflict::column(tenant::Column::Wallet)
                .do_nothing()
                .to_owned(),
        )
        .do_nothing()
        .exec(db)
        .await
        .map_err(DbErr::from)?;

    find_by_wallet(db, wallet)
        .await?
        .ok_or_else(|| GatewayError::Database("tenant upsert: wallet not found after insert".into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{test_cleanup, test_db};
    use serial_test::serial;

    async fn cleanup_tenants(db: &DatabaseConnection) {
        test_cleanup(db).await;
    }

    #[tokio::test]
    #[serial]
    async fn find_by_wallet_returns_none_for_unknown() {
        let db = test_db().await;
        cleanup_tenants(&db).await;
        assert!(find_by_wallet(&db, "unknown_wallet").await.unwrap().is_none());
    }

    #[tokio::test]
    #[serial]
    async fn find_or_create_creates_new_tenant() {
        let db = test_db().await;
        cleanup_tenants(&db).await;
        let tenant = find_or_create(&db, "wallet_abc", 1000).await.unwrap();
        assert_eq!(tenant.wallet, "wallet_abc");
        assert_eq!(tenant.tier, "developer");
        assert_eq!(tenant.created_at, 1000);
    }

    #[tokio::test]
    #[serial]
    async fn find_or_create_returns_existing() {
        let db = test_db().await;
        cleanup_tenants(&db).await;
        let t1 = find_or_create(&db, "wallet_xyz", 1000).await.unwrap();
        let t2 = find_or_create(&db, "wallet_xyz", 2000).await.unwrap();
        assert_eq!(t1.id, t2.id);
        assert_eq!(t2.created_at, 1000);
    }

    #[tokio::test]
    #[serial]
    async fn find_by_id_works() {
        let db = test_db().await;
        cleanup_tenants(&db).await;
        let tenant = find_or_create(&db, "wallet_id_test", 500).await.unwrap();
        let found = find_by_id(&db, tenant.id).await.unwrap().unwrap();
        assert_eq!(found.wallet, "wallet_id_test");
    }
}
