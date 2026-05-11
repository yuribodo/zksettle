pub use sea_orm_migration::prelude::*;

mod m20260430_001_create_events_table;
mod m20260430_002_add_slot_id_index;
mod m20260501_001_drop_payer_column;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migration_table_name() -> sea_orm::DynIden {
        sea_orm::sea_query::Alias::new("seaql_migrations_indexer").into_iden()
    }

    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260430_001_create_events_table::Migration),
            Box::new(m20260430_002_add_slot_id_index::Migration),
            Box::new(m20260501_001_drop_payer_column::Migration),
        ]
    }
}
