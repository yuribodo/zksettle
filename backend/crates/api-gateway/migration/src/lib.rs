pub use sea_orm_migration::prelude::*;

mod m20260426_001_create_gateway_tables;
mod m20260502_001_create_tenants;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260426_001_create_gateway_tables::Migration),
            Box::new(m20260502_001_create_tenants::Migration),
        ]
    }
}
