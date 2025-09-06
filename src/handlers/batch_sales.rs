use crate::handlers::purchases::internal_error;
use crate::handlers::purchases::update_account_balance;
use crate::models::CreateBatchSale;
use axum::{extract::State, Json};
use chrono::Utc;
use entity::batch_closure_summary;
use entity::batch_sales;
use entity::ledger_entries;
use num_traits::ToPrimitive;
use reqwest::StatusCode;
use sea_orm::prelude::Decimal;
use sea_orm::ActiveModelTrait;
use sea_orm::ActiveValue::Set;
use sea_orm::ColumnTrait;
use sea_orm::DatabaseConnection;
use sea_orm::EntityTrait;
use sea_orm::QueryFilter;
use sea_orm::TransactionTrait;
use uuid::Uuid;

const CASH_ACCOUNT_ID: i32 = 101;
const REVENUE_ACCOUNT_ID: i32 = 108;

pub async fn create_batch_sale(
    State(db): State<DatabaseConnection>,
    Json(payload): Json<CreateBatchSale>,
) -> Result<Json<batch_sales::Model>, StatusCode> {
    let txn = db.begin().await.map_err(|err| {
        eprintln!("Failed to start transaction: {:?}", err);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let new_sale = batch_sales::ActiveModel {
        item_code: Set(payload.item_code),
        batch_id: Set(payload.batch_id),
        trader_id: Set(payload.trader_id),
        avg_weight: Set(payload.avg_weight),
        rate: Set(payload.rate),
        quantity: Set(payload.quantity),
        value: Set(payload.value),
        ..Default::default()
    };

    let inserted_sale = new_sale.insert(&txn).await.map_err(|err| {
        eprintln!("Failed to insert batch sale: {:?}", err);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Err(err_status) =
        insert_batch_sales_ledger_entries(&txn, &inserted_sale, payload.created_by).await
    {
        eprintln!("Failed to insert ledger entries for sale: {:?}", err_status);
        txn.rollback().await.ok();
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    if let Err(err) =
        update_batch_financials(&txn, payload.batch_id, payload.value, payload.quantity).await
    {
        eprintln!("Failed to update batch financials: {:?}", err);
        txn.rollback().await.ok();
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    txn.commit().await.map_err(|err| {
        eprintln!("Failed to commit transaction: {:?}", err);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(inserted_sale))
}

async fn update_batch_financials(
    txn: &sea_orm::DatabaseTransaction,
    batch_id: i32,
    added_value: Decimal,
    quantity: Decimal,
) -> Result<(), sea_orm::DbErr> {
    if let Some(batch) = batch_closure_summary::Entity::find()
        .filter(batch_closure_summary::Column::BatchId.eq(batch_id))
        .one(txn)
        .await?
    {
        let mut active: batch_closure_summary::ActiveModel = batch.into();
        let current_count = active.available_chicken_count.unwrap();
        let quantity_to_subtract = quantity.to_i32().unwrap();
        if current_count < quantity_to_subtract {
            return Err(sea_orm::DbErr::Custom(
                "Available chicken count would become negative".to_string(),
            ));
        }
        active.revenue = Set(active.revenue.unwrap() + added_value);
        active.gross_profit = Set(active.gross_profit.unwrap() + added_value);
        active.available_chicken_count = Set(current_count - quantity_to_subtract);

        active.update(txn).await?;
    }

    Ok(())
}

pub async fn insert_batch_sales_ledger_entries<C: TransactionTrait + sea_orm::ConnectionTrait>(
    txn: &C,
    sale: &batch_sales::Model,
    created_by: i32,
) -> Result<(), StatusCode> {
    let txn_group_id = Uuid::new_v4();
    let sale_value: Decimal = sale.value;

    // txn_date: use naive date (match your ledger_entries txn_date type)
    let txn_date = Utc::now().date_naive();

    // --- Debit: Cash account (Asset) ---
    let debit_entry = ledger_entries::ActiveModel {
        account_id: Set(CASH_ACCOUNT_ID),
        debit: Set(Some(sale_value)),
        credit: Set(None),
        txn_date: Set(txn_date),
        reference_table: Set(Some("batch_sales".into())),
        reference_id: Set(Some(sale.id)),
        narration: Set(Some(format!("Sale for batch {}", sale.batch_id))),
        txn_group_id: Set(txn_group_id),
        created_at: Set(Utc::now().into()),
        created_by: Set(Some(created_by)),
        ..Default::default()
    };

    debit_entry
        .insert(txn)
        .await
        .map_err(internal_error("insert ledger debit for batch sale"))?;

    // --- Credit: Revenue account (Revenue) ---
    let credit_entry = ledger_entries::ActiveModel {
        account_id: Set(REVENUE_ACCOUNT_ID),
        debit: Set(None),
        credit: Set(Some(sale_value)),
        txn_date: Set(txn_date),
        reference_table: Set(Some("batch_sales".into())),
        reference_id: Set(Some(sale.id)),
        narration: Set(Some(format!(
            "Revenue from sale for batch {}",
            sale.batch_id
        ))),
        txn_group_id: Set(txn_group_id),
        created_at: Set(Utc::now().into()),
        created_by: Set(Some(created_by)),
        ..Default::default()
    };

    credit_entry
        .insert(txn)
        .await
        .map_err(internal_error("insert ledger credit for batch sale"))?;

    // --- Update account balances ---
    // Cash account increases (Asset): pass is_debit = true
    update_account_balance(txn, CASH_ACCOUNT_ID, Some(sale_value), true).await?;

    // Revenue account increases (Revenue): pass is_debit = false (credit increases revenue)
    update_account_balance(txn, REVENUE_ACCOUNT_ID, Some(sale_value), false).await?;

    Ok(())
}
