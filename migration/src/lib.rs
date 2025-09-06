pub use sea_orm_migration::prelude::*;

mod m20220101_000001_create_table;
mod m20250810_161418_iteration1;
mod m20250819_083602_iteration_2;
mod m20250819_215006_ledger;
mod m20250826_234204_stock_receipts;
mod m20250901_223316_farmer_commission;
mod m20250906_182108_closed_batches;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20220101_000001_create_table::Migration),
            Box::new(m20250810_161418_iteration1::Migration),
            Box::new(m20250819_083602_iteration_2::Migration),
            Box::new(m20250819_215006_ledger::Migration),
            Box::new(m20250826_234204_stock_receipts::Migration),
            Box::new(m20250901_223316_farmer_commission::Migration),
            Box::new(m20250906_182108_closed_batches::Migration),
        ]
    }
}
