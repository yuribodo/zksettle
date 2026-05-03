use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Tenants::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Tenants::Id).uuid().not_null().primary_key())
                    .col(
                        ColumnDef::new(Tenants::Wallet)
                            .text()
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Tenants::Name).text())
                    .col(
                        ColumnDef::new(Tenants::Tier)
                            .text()
                            .not_null()
                            .default("developer"),
                    )
                    .col(ColumnDef::new(Tenants::CreatedAt).big_integer().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(ApiKeys::Table)
                    .add_column(ColumnDef::new(ApiKeys::TenantId).uuid())
                    .add_foreign_key(
                        TableForeignKey::new()
                            .name("fk_api_keys_tenant_id")
                            .from_tbl(ApiKeys::Table)
                            .from_col(ApiKeys::TenantId)
                            .to_tbl(Tenants::Table)
                            .to_col(Tenants::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_api_keys_tenant_id")
                    .table(ApiKeys::Table)
                    .col(ApiKeys::TenantId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(
                Index::drop()
                    .name("idx_api_keys_tenant_id")
                    .table(ApiKeys::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(ApiKeys::Table)
                    .drop_foreign_key(Alias::new("fk_api_keys_tenant_id"))
                    .drop_column(ApiKeys::TenantId)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(Tenants::Table).to_owned())
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum Tenants {
    Table,
    Id,
    Wallet,
    Name,
    Tier,
    CreatedAt,
}

#[derive(DeriveIden)]
enum ApiKeys {
    Table,
    TenantId,
}
