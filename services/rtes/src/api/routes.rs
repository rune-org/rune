use crate::api::{handlers, state::AppState, ws};
use axum::{
    http::Method,
    routing::{any, get},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

pub(crate) fn app(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST]);

    Router::new()
        .route("/health", get(handlers::health_check))
        .route("/ws", any(ws::ws_handler))
        .route("/executions/:id/status", get(handlers::get_execution_status))
        .route("/executions/:id/result", get(handlers::get_execution_result))
        .layer(cors)
        .with_state(state)
}
