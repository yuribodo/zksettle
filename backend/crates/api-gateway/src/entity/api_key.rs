use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "api_keys")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub key_hash: String,
    pub owner: String,
    pub tier: String,
    pub created_at: i64,
    pub tenant_id: Option<Uuid>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_one = "super::usage_record::Entity")]
    UsageRecord,
    #[sea_orm(has_many = "super::daily_usage::Entity")]
    DailyUsage,
    #[sea_orm(
        belongs_to = "super::tenant::Entity",
        from = "Column::TenantId",
        to = "super::tenant::Column::Id"
    )]
    Tenant,
}

impl Related<super::usage_record::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::UsageRecord.def()
    }
}

impl Related<super::daily_usage::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DailyUsage.def()
    }
}

impl Related<super::tenant::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tenant.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
