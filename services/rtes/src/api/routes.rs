use axum::{Router, http::Method, routing::{any, get}};
use tower_http::cors::{Any, CorsLayer};

use crate::api::{handlers, state::AppState, ws};

pub(crate) fn app(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS, Method::PUT, Method::DELETE, Method::PATCH]);

    Router::new()
        .route("/health", get(handlers::health_check))
        // WebSocket: Real-time updates for specific execution
        // Uses query params: ?execution_id=...&workflow_id=...
        .route("/rt", any(ws::ws_handler))
        // HTTP: Get specific past execution
        .route("/executions/{execution_id}", get(handlers::get_execution))
        // HTTP: Get all past executions for a workflow
        .route("/workflows/{workflow_id}/executions", get(handlers::get_workflow_executions))
        .layer(cors)
        .with_state(state)
}

