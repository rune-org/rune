use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;
use tracing::{error, warn};

use crate::api::state::AppState;

#[derive(Deserialize)]
pub(crate) struct AuthQuery {
    pub(crate) user_id:     String,
    pub(crate) workflow_id: String,
}

pub(crate) async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

pub(crate) async fn get_execution_hydrated(
    State(state): State<AppState>,
    Path(execution_id): Path<String>,
    Query(auth): Query<AuthQuery>,
) -> impl IntoResponse {
    match state
        .token_store
        .validate_access(&auth.user_id, Some(&execution_id), &auth.workflow_id)
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
