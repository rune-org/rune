use axum::{
    Router,
    http::{HeaderValue, Method},
    routing::{any, get},
};
use tower_http::cors::CorsLayer;

use crate::{
    api::{handlers, state::AppState, ws},
    config::Config,
};

pub(crate) fn app(state: AppState) -> Router {
    let cfg = Config::get();
    let cors = CorsLayer::new()
        .allow_origin(
            cfg.cors_origin
                .parse::<HeaderValue>()
                .unwrap_or_else(|_| HeaderValue::from_static("http://localhost:3000")),
        )
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::OPTIONS,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
        ])
        .allow_headers([axum::http::header::AUTHORIZATION, axum::http::header::CONTENT_TYPE])
        .allow_credentials(true);

    Router::new()
        .route("/health", get(handlers::health_check))
        // WebSocket: Real-time updates for specific execution
        // Uses query params: ?execution_id=...&workflow_id=...
        .route("/rt", any(ws::ws_handler))
        // HTTP: Get specific past execution
        .route("/executions/{execution_id}", get(handlers::get_execution))
        // HTTP: Get all past executions for a workflow
        .route("/workflows/{workflow_id}/executions", get(handlers::get_workflow_executions))
        // TODO: Add GET /executions endpoint to list all executions for the authenticated user
        // This is needed for the frontend /create/executions page
        .layer(cors)
        .with_state(state)
}
