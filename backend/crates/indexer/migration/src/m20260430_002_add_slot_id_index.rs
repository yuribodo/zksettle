use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(Index::drop().name("idx_events_slot").to_owned())
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_events_slot_id")
                    .table(Events::Table)
                    .col((Events::Slot, IndexOrder::Desc))
                    .col((Events::Id, IndexOrder::Desc))
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(Index::drop().name("idx_events_slot_id").to_owned())
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_events_slot")
                    .table(Events::Table)
                    .col((Events::Slot, IndexOrder::Desc))
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Events {
    Table,
    Slot,
    Id,
}
