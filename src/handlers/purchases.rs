use crate::models::CreatePurchase;
use axum::{extract::State, Json};
use chrono::Utc;
use entity::sea_orm_active_enums::MovementType;
use entity::{
    inventory, inventory_movements, ledger_accounts, ledger_entries, purchases, stock_receipts,
};
use reqwest::StatusCode;
use sea_orm::prelude::Decimal;
use sea_orm::ActiveModelTrait;
use sea_orm::EntityTrait;
use sea_orm::TransactionTrait;
use sea_orm::{ActiveValue::Set, DatabaseConnection};
use uuid::Uuid;

pub async fn create_purchase(
    State(db): State<DatabaseConnection>,
    Json(payload): Json<CreatePurchase>,
) -> Result<Json<purchases::Model>, StatusCode> {
    let txn = db
        .begin()
        .await
        .map_err(internal_error("begin transaction"))?;

    // 1. Insert purchase
    let purchase = insert_purchase(&txn, &payload).await?;

    // 2. Insert stock receipt
    insert_stock_receipt(&txn, &payload, purchase.purchase_id).await?;

    // 3. Update or create inventory
    upsert_inventory(&txn, &payload).await?;

    // 4. Insert inventory movement
    insert_inventory_movement(&txn, &payload, purchase.purchase_id).await?;

    // 5. Insert ledger entries
    insert_ledger_entries(&txn, &payload, &purchase).await?;

    txn.commit()
        .await
        .map_err(internal_error("commit transaction"))?;

    Ok(Json(purchase))
}

async fn insert_purchase<C: TransactionTrait + sea_orm::ConnectionTrait>(
    txn: &C,
    payload: &CreatePurchase,
) -> Result<purchases::Model, StatusCode> {
    let new_purchase = purchases::ActiveModel {
        item_code: Set(payload.item_code.clone()),
        cost_per_unit: Set(payload.cost_per_unit),
        total_cost: Set(payload.total_cost),
        quantity: Set(payload.quantity),
        purchase_date: Set(payload.purchase_date),
        supplier: Set(payload.supplier.clone()),
        created_by: Set(payload.created_by),
        ..Default::default()
    };

    new_purchase
        .insert(txn)
        .await
        .map_err(internal_error("insert purchase"))
}

async fn insert_stock_receipt<C: TransactionTrait + sea_orm::ConnectionTrait>(
    txn: &C,
    payload: &CreatePurchase,
    purchase_id: i32,
) -> Result<(), StatusCode> {
    let new_receipt = stock_receipts::ActiveModel {
        purchase_id: Set(Some(purchase_id)),
        item_code: Set(payload.item_code.clone()),
        received_qty: Set(payload.quantity),
        remaining_qty: Set(payload.quantity),
        unit_cost: Set(payload.cost_per_unit),
        received_date: Set(payload.purchase_date),
        supplier: Set(payload.supplier.clone()),
        ..Default::default()
    };

    new_receipt
        .insert(txn)
        .await
        .map_err(internal_error("insert stock_receipt"))?;
    Ok(())
}

async fn upsert_inventory<C: TransactionTrait + sea_orm::ConnectionTrait>(
    txn: &C,
    payload: &CreatePurchase,
) -> Result<(), StatusCode> {
    if let Some(inv) = inventory::Entity::find_by_id(payload.item_code.clone())
        .one(txn)
        .await
        .map_err(internal_error("fetch inventory"))?
    {
        let mut active_inv: inventory::ActiveModel = inv.into();
        active_inv.current_qty =
            Set(active_inv.current_qty.take().unwrap_or_default() + payload.quantity);
        active_inv.last_updated = Set(Utc::now().into());
        active_inv
            .update(txn)
            .await
            .map_err(internal_error("update inventory"))?;
    } else {
        let new_inv = inventory::ActiveModel {
            item_code: Set(payload.item_code.clone()),
            current_qty: Set(payload.quantity),
            last_updated: Set(Utc::now().into()),
        };
        new_inv
            .insert(txn)
            .await
            .map_err(internal_error("insert inventory"))?;
    }
    Ok(())
}

async fn insert_inventory_movement<C: TransactionTrait + sea_orm::ConnectionTrait>(
    txn: &C,
    payload: &CreatePurchase,
    purchase_id: i32,
) -> Result<(), StatusCode> {
    let movement = inventory_movements::ActiveModel {
        item_code: Set(payload.item_code.clone()),
        movement_type: Set(MovementType::Purchase),
        qty_change: Set(payload.quantity),
        reference_id: Set(Some(purchase_id)),
        ..Default::default()
    };

    movement
        .insert(txn)
        .await
        .map_err(internal_error("insert inventory movement"))?;
    Ok(())
}

async fn insert_ledger_entries<C: TransactionTrait + sea_orm::ConnectionTrait>(
    txn: &C,
    payload: &CreatePurchase,
    purchase: &purchases::Model,
) -> Result<(), StatusCode> {
    let total_cost = payload.total_cost;
    let txn_group_id = Uuid::new_v4();

    let inventory_account_id = payload.inventory_account_id;
    let payment_account_id = payload.payment_account_id;

    // Debit entry → Inventory (Asset)
    let debit_entry = ledger_entries::ActiveModel {
        account_id: Set(inventory_account_id),
        debit: Set(total_cost),
        credit: Set(None),
        txn_date: Set(purchase.purchase_date),
        reference_table: Set(Some("purchases".into())),
        reference_id: Set(Some(purchase.purchase_id)),
        narration: Set(Some(format!(
            "Purchase of {} (item {})",
            payload.quantity, payload.item_code
        ))),
        txn_group_id: Set(txn_group_id),
        created_at: Set(Utc::now().into()),
        created_by: Set(payload.created_by),
        ..Default::default()
    };

    debit_entry
        .insert(txn)
        .await
        .map_err(internal_error("insert ledger debit"))?;

    // Credit entry → Cash or Payables
    let credit_entry = ledger_entries::ActiveModel {
        account_id: Set(payment_account_id),
        debit: Set(None),
        credit: Set(total_cost),
        txn_date: Set(purchase.purchase_date),
        reference_table: Set(Some("purchases".into())),
        reference_id: Set(Some(purchase.purchase_id)),
        narration: Set(Some(format!(
            "Payment for purchase of {} (item {})",
            payload.quantity, payload.item_code
        ))),
        txn_group_id: Set(txn_group_id),
        created_at: Set(Utc::now().into()),
        created_by: Set(payload.created_by),
        ..Default::default()
    };

    credit_entry
        .insert(txn)
        .await
        .map_err(internal_error("insert ledger credit"))?;

    // Look for a better way to do this
    update_account_balance(txn, inventory_account_id, total_cost, true).await?;
    update_account_balance(txn, payment_account_id, total_cost, false).await?;

    Ok(())
}

pub async fn update_account_balance<C: TransactionTrait + sea_orm::ConnectionTrait>(
    txn: &C,
    account_id: i32,
    amount: Option<Decimal>,
    is_debit: bool, // true = debit, false = credit
) -> Result<(), StatusCode> {
    // 1. Fetch account
    if let Some(account) = ledger_accounts::Entity::find_by_id(account_id)
        .one(txn)
        .await
        .map_err(internal_error("fetch ledger account"))?
    {
        let mut active_account: ledger_accounts::ActiveModel = account.clone().into();

        let current_balance = active_account.current_balance.take().unwrap_or_default();
        let amount = amount.unwrap_or_default();

        // Decide effect based on account type
        use entity::sea_orm_active_enums::LedgerAccountType;
        let new_balance = match account.account_type {
            LedgerAccountType::Asset | LedgerAccountType::Expense => {
                if is_debit {
                    current_balance + amount
                } else {
                    current_balance - amount
                }
            }
            LedgerAccountType::Liability
            | LedgerAccountType::Equity
            | LedgerAccountType::Revenue => {
                if is_debit {
                    current_balance - amount
                } else {
                    current_balance + amount
                }
            }
        };

        active_account.current_balance = Set(new_balance);

        active_account
            .update(txn)
            .await
            .map_err(internal_error("update ledger account balance"))?;
    } else {
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(())
}

pub fn internal_error<E: std::fmt::Display>(action: &'static str) -> impl FnOnce(E) -> StatusCode {
    move |err| {
        eprintln!("Failed to {}: {}", action, err);
        StatusCode::INTERNAL_SERVER_ERROR
    }
}
// pub async fn create_purchase(
//     State(db): State<DatabaseConnection>,
//     Json(payload): Json<CreatePurchase>,
// ) -> Result<Json<purchases::Model>, StatusCode> {
//     let txn = db.begin().await.map_err(|err| {
//         eprintln!("Failed to begin transaction: {}", err);
//         StatusCode::INTERNAL_SERVER_ERROR
//     })?;

//     // Insert purchase
//     let new_purchase = purchases::ActiveModel {
//         item_code: Set(payload.item_code.clone()),
//         cost_per_unit: Set(payload.cost_per_unit),
//         total_cost: Set(payload.total_cost),
//         quantity: Set(payload.quantity),
//         purchase_date: Set(payload.purchase_date),
//         supplier: Set(payload.supplier.clone()),
//         created_by: Set(payload.created_by),
//         ..Default::default()
//     };

//     let purchase = new_purchase.insert(&txn).await.map_err(|err| {
//         eprintln!("Failed to insert purchase: {}", err);
//         StatusCode::INTERNAL_SERVER_ERROR
//     })?;
//     let new_receipt = stock_receipts::ActiveModel {
//         purchase_id: Set(Some(purchase.purchase_id)),
//         item_code: Set(payload.item_code.clone()),
//         received_qty: Set(payload.quantity),
//         remaining_qty: Set(payload.quantity),
//         unit_cost: Set(payload.cost_per_unit),
//         received_date: Set(payload.purchase_date),
//         supplier: Set(payload.supplier.clone()),
//         ..Default::default()
//     };

//     let receipt = new_receipt.insert(&txn).await.map_err(|err| {
//         eprintln!("Failed to insert stock_receipt: {}", err);
//         StatusCode::INTERNAL_SERVER_ERROR
//     })?;
//     println!("DEBUG: inserted stock_receipt within txn: {:?}", receipt);

//     // Insert/Update inventory
//     if let Some(inv) = inventory::Entity::find_by_id(payload.item_code.clone())
//         .one(&txn)
//         .await
//         .map_err(|err| {
//             eprintln!("Failed to fetch inventory: {}", err);
//             StatusCode::INTERNAL_SERVER_ERROR
//         })?
//     {
//         // Item already exists → update
//         let mut active_inv: inventory::ActiveModel = inv.into();
//         active_inv.current_qty =
//             Set(active_inv.current_qty.take().unwrap_or_default() + payload.quantity);
//         active_inv.last_updated = Set(Utc::now().into());
//         active_inv.update(&txn).await.map_err(|err| {
//             eprintln!("Failed to update inventory: {}", err);
//             StatusCode::INTERNAL_SERVER_ERROR
//         })?;
//     } else {
//         // Item does not exist → create
//         let new_inv = inventory::ActiveModel {
//             item_code: Set(payload.item_code.clone()),
//             current_qty: Set(payload.quantity),
//             last_updated: Set(Utc::now().into()),
//         };
//         new_inv.insert(&txn).await.map_err(|err| {
//             eprintln!("Failed to insert inventory: {}", err);
//             StatusCode::INTERNAL_SERVER_ERROR
//         })?;
//     }

//     // Insert inventory movement
//     let movement = inventory_movements::ActiveModel {
//         item_code: Set(payload.item_code.clone()),
//         movement_type: Set(MovementType::Purchase),
//         qty_change: Set(payload.quantity),
//         reference_id: Set(Some(purchase.purchase_id)),
//         ..Default::default()
//     };

//     movement.insert(&txn).await.map_err(|err| {
//         eprintln!("Failed to insert inventory movement: {}", err);
//         StatusCode::INTERNAL_SERVER_ERROR
//     })?;

//     let total_cost = payload.total_cost;

//     // Debit → Inventory
//     let debit_entry = ledger_entries::ActiveModel {
//         transaction_type: Set(LedgerAccountType::Asset),
//         debit: Set(total_cost),
//         credit: Set(None),
//         txn_date: Set(purchase.purchase_date),
//         reference_table: Set(Some("purchases".into())),
//         reference_id: Set(Some(purchase.purchase_id)),
//         narration: Set(Some(format!(
//             "Purchase of {} (item {})",
//             payload.quantity, payload.item_code
//         ))),
//         created_at: Set(Utc::now().into()),
//         created_by: Set(payload.created_by),
//         ..Default::default()
//     };

//     debit_entry.insert(&txn).await.map_err(|err| {
//         eprintln!("Failed to insert ledger debit entry: {}", err);
//         StatusCode::INTERNAL_SERVER_ERROR
//     })?;

//     // Credit → chosen account (Cash / Payables etc.)
//     let credit_entry = ledger_entries::ActiveModel {
//         transaction_type: Set(payload.payment_account.clone()),
//         debit: Set(None),
//         credit: Set(total_cost),
//         txn_date: Set(purchase.purchase_date),
//         reference_table: Set(Some("purchases".into())),
//         reference_id: Set(Some(purchase.purchase_id)),
//         narration: Set(Some(format!(
//             "Payment for purchase of {} (item {})",
//             payload.quantity, payload.item_code
//         ))),
//         created_at: Set(Utc::now().into()),
//         created_by: Set(payload.created_by),
//         ..Default::default()
//     };

//     credit_entry.insert(&txn).await.map_err(|err| {
//         eprintln!("Failed to insert ledger credit entry: {}", err);
//         StatusCode::INTERNAL_SERVER_ERROR
//     })?;

//     txn.commit().await.map_err(|err| {
//         eprintln!("Failed to commit transaction: {}", err);
//         StatusCode::INTERNAL_SERVER_ERROR
//     })?;

//     Ok(Json(purchase))
// }
