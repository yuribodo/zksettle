use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Events {
    Table,
    Payer,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Events::Table)
                    .drop_column(Events::Payer)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Events::Table)
                    .add_column(
                        ColumnDef::new(Events::Payer)
                            .text()
                            .not_null()
                            .default(""),
                    )
                    .to_owned(),
            )
            .await
    }
}
