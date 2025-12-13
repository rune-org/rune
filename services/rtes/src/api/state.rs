use tokio::sync::broadcast;

use crate::{
    domain::models::WorkerMessage,
    infra::{execution_store::ExecutionStore, token_store::TokenStore},
};

#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) token_store: TokenStore,
    pub(crate) execution_store: ExecutionStore,
    pub(crate) tx: broadcast::Sender<WorkerMessage>,
}

impl AppState {
    pub(crate) fn new(token_store: TokenStore, execution_store: ExecutionStore) -> Self {
        let (tx, _) = broadcast::channel(100);
        Self { token_store, execution_store, tx }
    }
}
