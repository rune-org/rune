use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use jsonwebtoken::{DecodingKey, Validation, decode};
use tracing::{error, warn};

use crate::api::{
    state::AppState,
    ws::{AuthParams, Claims},
};

pub(crate) async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

pub(crate) async fn get_execution_hydrated(
    State(state): State<AppState>,
    Path(execution_id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let token = match headers.get("Authorization") {
        Some(value) => value.to_str().unwrap_or("").replace("Bearer ", ""),
        None => {
            return (StatusCode::UNAUTHORIZED, "Missing Authorization header").into_response();
        },
    };

    let cfg = crate::config::Config::get();
    let validation = Validation::default();
    let token_data = match decode::<Claims>(
        &token,
        &DecodingKey::from_secret(cfg.jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(c) => c,
        Err(e) => {
            warn!("Invalid JWT token: {}", e);
            return (StatusCode::UNAUTHORIZED, "Invalid Token").into_response();
        },
    };

    let params = AuthParams {
        user_id:      token_data.claims.user_id,
        execution_id: token_data.claims.execution_id,
        workflow_id:  token_data.claims.workflow_id,
    };
    match state
        .token_store
        .validate_access(&params.user_id, Some(&execution_id), &params.workflow_id)
        .await
    {
        Ok(true) => match state
            .execution_store
            .get_execution_document(&execution_id)
            .await
        {
            Ok(Some(doc)) => Json(doc).into_response(),
            Ok(None) => (StatusCode::NOT_FOUND, "Execution not found").into_response(),
            Err(e) => {
                error!("Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database Error").into_response()
            },
        },
        Ok(false) => {
            warn!("Unauthorized access attempt for execution: {}", execution_id);
            (StatusCode::FORBIDDEN, "Unauthorized").into_response()
        },
        Err(e) => {
            error!("Token validation error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal Error").into_response()
        },
    }
}
