use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, serde::Serialize, serde::Deserialize)]
#[sea_orm(table_name = "events")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub signature: String,
    pub slot: i64,
    pub timestamp: i64,
    pub issuer: String,
    pub nullifier_hash: String,
    pub merkle_root: String,
    pub sanctions_root: String,
    pub jurisdiction_root: String,
    pub mint: String,
    pub recipient: String,
    pub payer: String,
    pub amount: i64,
    pub epoch: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
