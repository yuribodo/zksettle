pub use sea_orm_migration::prelude::*;

mod m20260430_001_create_events_table;
mod m20260430_002_add_slot_id_index;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260430_001_create_events_table::Migration),
            Box::new(m20260430_002_add_slot_id_index::Migration),
        ]
    }
}
