use std::collections::{HashMap, HashSet};

use crate::models::{
    BatchRequirementResponse, BatchResponse, ProductionLineWithSupervisor, PurchaseWithItem,
    UserSimplified,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use entity::{sea_orm_active_enums::UserRole, *};
use sea_orm::ColumnTrait;
use sea_orm::{DatabaseConnection, EntityTrait, QueryFilter};

// USERS
pub async fn get_users_handler(State(db): State<DatabaseConnection>) -> impl IntoResponse {
    match users::Entity::find().all(&db).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => {
            eprintln!("Failed to fetch users: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// PRODUCTION_LINES
pub async fn get_production_lines_handler(
    State(db): State<DatabaseConnection>,
) -> impl IntoResponse {
    let res = production_lines::Entity::find()
        .find_also_related(users::Entity) // performs LEFT JOIN automatically
        .all(&db)
        .await;

    match res {
        Ok(data) => {
            // Map into custom struct
            let result: Vec<ProductionLineWithSupervisor> = data
                .into_iter()
                .filter_map(|(line, supervisor)| {
                    supervisor.map(|sup| ProductionLineWithSupervisor {
                        line_id: line.line_id,
                        line_name: line.line_name,
                        supervisor_id: line.supervisor_id,
                        supervisor_name: sup.name,
                        created_at: line.created_at,
                    })
                })
                .collect();

            Json(result).into_response()
        }
        Err(e) => {
            eprintln!("Failed to fetch production lines: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// PURCHASES
pub async fn get_purchases_handler(State(db): State<DatabaseConnection>) -> impl IntoResponse {
    // find purchases and also the related item (LEFT JOIN semantics via find_also_related)
    match purchases::Entity::find()
        .find_also_related(items::Entity)
        .all(&db)
        .await
    {
        Ok(rows) => {
            let resp: Vec<PurchaseWithItem> = rows
                .into_iter()
                .map(|(p, item_opt)| PurchaseWithItem {
                    purchase_id: p.purchase_id,
                    item_code: p.item_code,
                    // if item missing, fall back to empty string (adjust if you prefer null)
                    item_name: item_opt.map(|i| i.item_name).unwrap_or_default(),
                    cost_per_unit: p.cost_per_unit,
                    total_cost: p.total_cost,
                    purchase_date: p.purchase_date,
                    supplier: p.supplier,
                    created_by: p.created_by,
                })
                .collect();

            (StatusCode::OK, Json(resp)).into_response()
        }
        Err(e) => {
            eprintln!("Failed to fetch purchases with items: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// ITEMS
pub async fn get_items_handler(State(db): State<DatabaseConnection>) -> impl IntoResponse {
    match items::Entity::find().all(&db).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => {
            eprintln!("Failed to items table: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// BATCHES

pub async fn get_batches_handler(State(db): State<DatabaseConnection>) -> impl IntoResponse {
    // Join with related entities
    let batches_with_relations = batches::Entity::find()
        .find_also_related(users::Entity)
        .find_also_related(farmers::Entity)
        .all(&db)
        .await;

    match batches_with_relations {
        Ok(records) => {
            let data: Vec<BatchResponse> = records
                .into_iter()
                .filter_map(|(batch, user_opt, farmer_opt)| {
                    Some(BatchResponse {
                        batch_id: batch.batch_id,
                        line_id: batch.line_id,
                        supervisor_id: batch.supervisor_id,
                        supervisor_name: user_opt?.name, // unwrap supervisor
                        farmer_id: batch.farmer_id,
                        farmer_name: farmer_opt?.name, // unwrap farmer
                        start_date: batch.start_date,
                        end_date: batch.end_date,
                        initial_bird_count: batch.initial_bird_count,
                        current_bird_count: batch.current_bird_count,
                        status: batch.status,
                        created_at: batch.created_at,
                    })
                })
                .collect();

            Json(data).into_response()
        }
        Err(e) => {
            eprintln!("Failed raw SQL query: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}
// BATCH_REQUIREMENTS -> reduce query time
pub async fn get_batch_requirements_handler(
    State(db): State<DatabaseConnection>,
) -> impl IntoResponse {
    // 1) fetch requirements + optionally related line and item (single query)
    let req_with_rel = match batch_requirements::Entity::find()
        .find_also_related(production_lines::Entity)
        .find_also_related(items::Entity)
        .all(&db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Failed to fetch batch requirements: {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    // collect batch_ids referenced by the requirements
    let batch_ids: HashSet<i32> = req_with_rel
        .iter()
        .map(|(req, _, _)| req.batch_id)
        .collect();

    // 2) fetch batches for those batch_ids (single query)
    let batches_vec = if batch_ids.is_empty() {
        vec![]
    } else {
        match batches::Entity::find()
            .filter(batches::Column::BatchId.is_in(batch_ids.iter().cloned().collect::<Vec<_>>()))
            .all(&db)
            .await
        {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Failed to fetch batches: {}", e);
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        }
    };

    // map batch_id -> batch model
    let batches_map: HashMap<i32, batches::Model> =
        batches_vec.into_iter().map(|b| (b.batch_id, b)).collect();

    // collect supervisor_ids and farmer_ids from batches
    let mut supervisor_ids = HashSet::<i32>::new();
    let mut farmer_ids = HashSet::<i32>::new();
    for batch in batches_map.values() {
        supervisor_ids.insert(batch.supervisor_id);
        farmer_ids.insert(batch.farmer_id);
    }

    // 3) fetch users (supervisors) referenced (single query)
    let users_vec = if supervisor_ids.is_empty() {
        vec![]
    } else {
        match users::Entity::find()
            .filter(users::Column::UserId.is_in(supervisor_ids.iter().cloned().collect::<Vec<_>>()))
            .all(&db)
            .await
        {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Failed to fetch users: {}", e);
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        }
    };
    let users_map: HashMap<i32, String> =
        users_vec.into_iter().map(|u| (u.user_id, u.name)).collect();

    // 4) fetch farmers referenced (single query)
    let farmers_vec = if farmer_ids.is_empty() {
        vec![]
    } else {
        match farmers::Entity::find()
            .filter(farmers::Column::FarmerId.is_in(farmer_ids.iter().cloned().collect::<Vec<_>>()))
            .all(&db)
            .await
        {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Failed to fetch farmers: {}", e);
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        }
    };
    let farmers_map: HashMap<i32, String> = farmers_vec
        .into_iter()
        .map(|f| (f.farmer_id, f.name))
        .collect();

    // 5) assemble final response
    let response: Vec<BatchRequirementResponse> = req_with_rel
        .into_iter()
        .map(|(req, line_opt, item_opt)| {
            // find batch, then lookup supervisor & farmer names
            let supervisor_name = batches_map
                .get(&req.batch_id)
                .and_then(|b| users_map.get(&b.supervisor_id))
                .cloned();
            let farmer_name = batches_map
                .get(&req.batch_id)
                .and_then(|b| farmers_map.get(&b.farmer_id))
                .cloned();

            BatchRequirementResponse {
                requirement_id: req.requirement_id,
                line_id: req.line_id,
                // borrow and clone the inner fields so we don't move `line_opt`
                line_name: line_opt.as_ref().map(|l| l.line_name.clone()),
                batch_id: req.batch_id,
                item_code: req.item_code.clone(),
                // borrow and clone item fields so item_opt is not moved
                item_name: item_opt.as_ref().map(|i| i.item_name.clone()),
                item_unit: item_opt.as_ref().and_then(|i| i.unit.clone()),
                quantity: req.quantity,
                // convert enum to string (assuming RequirementStatus implements Display/DeriveActiveEnum -> to_string works)
                status: req.status,
                request_date: req.request_date,
                supervisor_name,
                farmer_name,
            }
        })
        .collect();
    Json(response).into_response()
}
// BATCH_ALLOCATIONS
pub async fn get_batch_allocations_handler(
    State(db): State<DatabaseConnection>,
) -> impl IntoResponse {
    match batch_allocations::Entity::find().all(&db).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => {
            eprintln!("Failed to fetch batch allocations: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// FARMERS
pub async fn get_farmers_handler(State(db): State<DatabaseConnection>) -> impl IntoResponse {
    match farmers::Entity::find().all(&db).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => {
            eprintln!("Failed to fetch farmers: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// TRADERS
pub async fn get_traders_handler(State(db): State<DatabaseConnection>) -> impl IntoResponse {
    match traders::Entity::find().all(&db).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => {
            eprintln!("Failed to fetch traders: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// SUPPLIERS
pub async fn get_suppliers_handler(State(db): State<DatabaseConnection>) -> impl IntoResponse {
    match suppliers::Entity::find().all(&db).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => {
            eprintln!("Failed to fetch suppliers: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// BIRD_COUNT_HISTORY
pub async fn get_bird_count_history_handler(
    State(db): State<DatabaseConnection>,
) -> impl IntoResponse {
    match bird_count_history::Entity::find().all(&db).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => {
            eprintln!("Failed to fetch bird count history: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// BIRD_SELL_HISTORY
pub async fn get_bird_sell_history_handler(
    State(db): State<DatabaseConnection>,
) -> impl IntoResponse {
    match bird_sell_history::Entity::find().all(&db).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => {
            eprintln!("Failed to fetch bird sell history: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

pub async fn get_supervisors_handler(State(db): State<DatabaseConnection>) -> impl IntoResponse {
    match users::Entity::find()
        .filter(users::Column::Role.eq(UserRole::Supervisor)) // only supervisors
        .all(&db)
        .await
    {
        Ok(data) => {
            let supervisors: Vec<UserSimplified> = data
                .into_iter()
                .map(|u| UserSimplified {
                    user_id: u.user_id,
                    name: u.name,
                    role: u.role, // convert enum -> string
                })
                .collect();

            Json(supervisors).into_response()
        }
        Err(e) => {
            eprintln!("Failed to fetch supervisors: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// INVENTORY
pub async fn get_inventory_handler(
    State(db): State<DatabaseConnection>,
) -> impl IntoResponse {
    match inventory::Entity::find().all(&db).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => {
            eprintln!("Failed to fetch inventory: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

pub async fn get_inventory_movements_handler(
    State(db): State<DatabaseConnection>,
) -> impl IntoResponse {
    match inventory_movements::Entity::find().all(&db).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => {
            eprintln!("Failed to fetch inventory movements: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}
