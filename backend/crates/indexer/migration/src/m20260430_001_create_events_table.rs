use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Events::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Events::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Events::Signature).text().not_null())
                    .col(ColumnDef::new(Events::Slot).big_integer().not_null())
                    .col(ColumnDef::new(Events::Timestamp).big_integer().not_null())
                    .col(ColumnDef::new(Events::Issuer).text().not_null())
                    .col(
                        ColumnDef::new(Events::NullifierHash)
                            .text()
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Events::MerkleRoot).text().not_null())
                    .col(ColumnDef::new(Events::SanctionsRoot).text().not_null())
                    .col(ColumnDef::new(Events::JurisdictionRoot).text().not_null())
                    .col(ColumnDef::new(Events::Mint).text().not_null())
                    .col(ColumnDef::new(Events::Recipient).text().not_null())
                    .col(ColumnDef::new(Events::Payer).text().not_null())
                    .col(ColumnDef::new(Events::Amount).big_integer().not_null())
                    .col(ColumnDef::new(Events::Epoch).big_integer().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_events_slot")
                    .table(Events::Table)
                    .col((Events::Slot, IndexOrder::Desc))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_events_timestamp")
                    .table(Events::Table)
                    .col(Events::Timestamp)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_events_issuer")
                    .table(Events::Table)
                    .col(Events::Issuer)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_events_recipient")
                    .table(Events::Table)
                    .col(Events::Recipient)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Events::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Events {
    Table,
    Id,
    Signature,
    Slot,
    Timestamp,
    Issuer,
    NullifierHash,
    MerkleRoot,
    SanctionsRoot,
    JurisdictionRoot,
    Mint,
    Recipient,
    Payer,
    Amount,
    Epoch,
}
