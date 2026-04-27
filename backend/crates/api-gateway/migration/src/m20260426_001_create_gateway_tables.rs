use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ApiKeys::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ApiKeys::KeyHash)
                            .string_len(64)
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(ApiKeys::Owner).text().not_null())
                    .col(ColumnDef::new(ApiKeys::Tier).text().not_null())
                    .col(ColumnDef::new(ApiKeys::CreatedAt).big_integer().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(UsageRecords::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(UsageRecords::KeyHash)
                            .string_len(64)
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(UsageRecords::RequestCount)
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(UsageRecords::PeriodStart)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(UsageRecords::LastRequest)
                            .big_integer()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(UsageRecords::Table, UsageRecords::KeyHash)
                            .to(ApiKeys::Table, ApiKeys::KeyHash)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(DailyUsage::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(DailyUsage::KeyHash)
                            .string_len(64)
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(DailyUsage::DayStart)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(DailyUsage::Count)
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .primary_key(
                        Index::create()
                            .col(DailyUsage::KeyHash)
                            .col(DailyUsage::DayStart),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(DailyUsage::Table, DailyUsage::KeyHash)
                            .to(ApiKeys::Table, ApiKeys::KeyHash)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_daily_usage_key")
                    .table(DailyUsage::Table)
                    .col(DailyUsage::KeyHash)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(DailyUsage::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(UsageRecords::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(ApiKeys::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum ApiKeys {
    Table,
    KeyHash,
    Owner,
    Tier,
    CreatedAt,
}

#[derive(DeriveIden)]
enum UsageRecords {
    Table,
    KeyHash,
    RequestCount,
    PeriodStart,
    LastRequest,
}

#[derive(DeriveIden)]
enum DailyUsage {
    Table,
    KeyHash,
    DayStart,
    Count,
}
