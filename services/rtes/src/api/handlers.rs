use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use jsonwebtoken::{DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{error, info, warn};

use crate::api::state::AppState;

/// JWT claims - uses frontend's existing JWT with 'sub' field for user_id
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    /// User ID from JWT 'sub' claim
    sub: String,
    /// Expiry timestamp
    exp: usize,
    /// Accept any other fields without failing deserialization
    #[serde(flatten)]
    extra: HashMap<String, Value>,
}

pub(crate) async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

/// Helper to extract and validate JWT, returning user_id on success
/// Returns None if no Authorization header present (to allow fallback to token-based auth)
fn try_extract_user_id(headers: &HeaderMap) -> Option<Result<String, (StatusCode, &'static str)>> {
    let token = match headers.get("Authorization") {
        Some(value) => value.to_str().unwrap_or("").replace("Bearer ", ""),
        None => return None, // No header = try token-based auth
    };

    let cfg = crate::config::Config::get();
    let validation = Validation::default();

    Some(match decode::<Claims>(
        &token,
        &DecodingKey::from_secret(cfg.jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(c) => Ok(c.claims.sub),
        Err(e) => {
            warn!("Invalid JWT token: {}", e);
            Err((StatusCode::UNAUTHORIZED, "Invalid Token"))
        },
    })
}

/// GET /executions/{execution_id} - Get a specific past execution
pub(crate) async fn get_execution(
    State(state): State<AppState>,
    Path(execution_id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    // First, fetch the execution to get its workflow_id for validation
    let doc = match state.execution_store.get_execution_document(&execution_id).await {
        Ok(Some(doc)) => doc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Execution not found").into_response(),
        Err(e) => {
            error!("Database error: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database Error").into_response();
        }
    };

    let workflow_id = &doc.workflow_id;

    // Try JWT-based auth first
    if let Some(jwt_result) = try_extract_user_id(&headers) {
        match jwt_result {
            Ok(user_id) => {
                // Validate user has access to this execution
                match state
                    .token_store
                    .validate_access_for_execution(&user_id, &execution_id)
                    .await
                {
                    Ok(true) => return Json(doc).into_response(),
                    Ok(false) => {
                        warn!("Unauthorized access attempt for execution: {}", execution_id);
                        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
                    }
                    Err(e) => {
                        error!("Token validation error: {}", e);
                        return (StatusCode::INTERNAL_SERVER_ERROR, "Internal Error").into_response();
                    }
                }
            }
            Err(e) => return e.into_response(),
        }
    }

    // Fallback: Token-based auth (execution_id + workflow_id validation)
    info!("No JWT provided, trying token-based auth for execution {}", execution_id);
    match state
        .token_store
        .validate_execution_access(&execution_id, workflow_id)
        .await
    {
        Ok(true) => Json(doc).into_response(),
        Ok(false) => {
            warn!("Unauthorized access attempt for execution: {}", execution_id);
            (StatusCode::UNAUTHORIZED, "Unauthorized").into_response()
        }
        Err(e) => {
            error!("Token validation error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal Error").into_response()
        }
    }
}

/// GET /workflows/{workflow_id}/executions - Get all past executions for a workflow
pub(crate) async fn get_workflow_executions(
    State(state): State<AppState>,
    Path(workflow_id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    // Try JWT-based auth first
    if let Some(jwt_result) = try_extract_user_id(&headers) {
        match jwt_result {
            Ok(user_id) => {
                // Validate user has access to this workflow (wildcard or specific execution grant)
                match state
                    .token_store
                    .validate_access(&user_id, None, &workflow_id)
                    .await
                {
                    Ok(true) => {
                        return match state
                            .execution_store
                            .get_executions_for_workflow(&workflow_id)
                            .await
                        {
                            Ok(executions) => Json(executions).into_response(),
                            Err(e) => {
                                error!("Database error: {}", e);
                                (StatusCode::INTERNAL_SERVER_ERROR, "Database Error").into_response()
                            }
                        }
                    }
                    Ok(false) => {
                        warn!("Unauthorized access attempt for workflow: {}", workflow_id);
                        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
                    }
                    Err(e) => {
                        error!("Token validation error: {}", e);
                        return (StatusCode::INTERNAL_SERVER_ERROR, "Internal Error").into_response();
                    }
                }
            }
            Err(e) => return e.into_response(),
        }
    }

    // Fallback: Token-based auth (workflow_id validation via Redis index)
    info!("No JWT provided, trying token-based auth for workflow {}", workflow_id);
    match state.token_store.validate_workflow_access(&workflow_id).await {
        Ok(true) => match state
            .execution_store
            .get_executions_for_workflow(&workflow_id)
            .await
        {
            Ok(executions) => Json(executions).into_response(),
            Err(e) => {
                error!("Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database Error").into_response()
            }
        },
        Ok(false) => {
            warn!("Unauthorized access attempt for workflow: {}", workflow_id);
            (StatusCode::UNAUTHORIZED, "Unauthorized").into_response()
        }
        Err(e) => {
            error!("Token validation error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal Error").into_response()
        }
    }
}
