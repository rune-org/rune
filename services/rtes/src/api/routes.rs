use axum::Router;

pub fn app() -> Router {
    Router::new()
        // .merge(ws::routes())
        // .merge(handlers::routes())
}
