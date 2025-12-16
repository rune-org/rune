use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use jsonwebtoken::{DecodingKey, Validation, decode};
use tracing::{error, warn};

use crate::api::{state::AppState, ws::Claims};

pub(crate) async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

/// Helper to extract and validate JWT, returning user_id on success
async fn extract_user_id(headers: &HeaderMap) -> Result<String, (StatusCode, &'static str)> {
    let token = match headers.get("Authorization") {
        Some(value) => value.to_str().unwrap_or("").replace("Bearer ", ""),
        None => return Err((StatusCode::UNAUTHORIZED, "Missing Authorization header")),
    };

    let cfg = crate::config::Config::get();
    let validation = Validation::default();
    
    match decode::<Claims>(
        &token,
        &DecodingKey::from_secret(cfg.jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(c) => Ok(c.claims.sub),
        Err(e) => {
            warn!("Invalid JWT token: {}", e);
            Err((StatusCode::UNAUTHORIZED, "Invalid Token"))
        },
    }
}

/// GET /executions/{execution_id} - Get a specific past execution
pub(crate) async fn get_execution(
    State(state): State<AppState>,
    Path(execution_id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match extract_user_id(&headers).await {
        Ok(id) => id,
        Err(e) => return e.into_response(),
    };

    // Validate user has access to this execution
    match state
        .token_store
        .validate_access_for_execution(&user_id, &execution_id)
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

/// GET /workflows/{workflow_id}/executions - Get all past executions for a workflow
pub(crate) async fn get_workflow_executions(
    State(state): State<AppState>,
    Path(workflow_id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match extract_user_id(&headers).await {
        Ok(id) => id,
        Err(e) => return e.into_response(),
    };

    // Validate user has access to this workflow (wildcard or specific execution grant)
    match state
        .token_store
        .validate_access(&user_id, None, &workflow_id)
        .await
    {
        Ok(true) => match state
            .execution_store
            .get_executions_for_workflow(&workflow_id)
            .await
        {
            Ok(executions) => Json(executions).into_response(),
            Err(e) => {
                error!("Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database Error").into_response()
            },
        },
        Ok(false) => {
            warn!("Unauthorized access attempt for workflow: {}", workflow_id);
            (StatusCode::FORBIDDEN, "Unauthorized").into_response()
        },
        Err(e) => {
            error!("Token validation error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal Error").into_response()
        },
    }
}
