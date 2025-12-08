use axum::Router;

pub(crate) fn app() -> Router {
    Router::new()
        // .merge(ws::routes())
        // .merge(handlers::routes())
}
