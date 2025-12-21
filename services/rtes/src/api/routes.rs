use axum::{Router, http::Method, routing::{any, get}};
use tower_http::cors::{Any, CorsLayer};

use crate::api::{handlers, state::AppState, ws};

pub(crate) fn app(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS, Method::PUT, Method::DELETE, Method::PATCH]);

    Router::new()
        .route("/health", get(handlers::health_check))
        .route("/rt", any(ws::ws_handler))
        .route("/executions/{id}", get(handlers::get_execution_hydrated))
        .layer(cors)
        .with_state(state)
}
