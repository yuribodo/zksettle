use api_gateway_migration::{Migrator, MigratorTrait};
use sea_orm::{ConnectOptions, Database, DatabaseConnection};

use crate::error::GatewayError;

pub async fn connect_and_migrate(database_url: &str) -> Result<DatabaseConnection, GatewayError> {
    let mut opts = ConnectOptions::new(database_url);
    opts.max_connections(20)
        .min_connections(2)
        .sqlx_logging(false);

    let db = Database::connect(opts)
        .await
        .map_err(|e| GatewayError::Database(e.to_string()))?;

    Migrator::up(&db, None)
        .await
        .map_err(|e| GatewayError::Database(format!("migration failed: {e}")))?;

    Ok(db)
}
