use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::broadcast;

use crate::domain::models::{
    CompletionMessage,
    ExecutionDocument,
    ExecutionToken,
    NodeExecutionMessage,
    NodeStatusMessage,
    WorkerMessage,
};

pub type StoreError = Box<dyn std::error::Error + Send + Sync>;
pub type StoreResult<T> = Result<T, StoreError>;

#[async_trait]
pub trait TokenStorePort: Send + Sync {
    async fn add_token(&self, token: &ExecutionToken) -> StoreResult<()>;

    async fn validate_access(
        &self,
        user_id: &str,
        target_execution_id: Option<&str>,
        target_workflow_id: &str,
    ) -> StoreResult<bool>;

    async fn validate_access_for_execution(
        &self,
        user_id: &str,
        target_execution_id: &str,
    ) -> StoreResult<bool>;

    async fn validate_execution_access(
        &self,
        target_execution_id: &str,
        target_workflow_id: &str,
    ) -> StoreResult<bool>;

    async fn validate_workflow_access(&self, target_workflow_id: &str) -> StoreResult<bool>;
}

#[async_trait]
pub trait ExecutionStorePort: Send + Sync {
    async fn upsert_execution_definition(&self, msg: &NodeExecutionMessage) -> StoreResult<()>;

    async fn get_execution_document(
        &self,
        execution_id: &str,
    ) -> StoreResult<Option<ExecutionDocument>>;

    async fn get_executions_for_workflow(
        &self,
        workflow_id: &str,
    ) -> StoreResult<Vec<ExecutionDocument>>;

    async fn update_node_status(&self, msg: &NodeStatusMessage) -> StoreResult<()>;

    async fn complete_execution(&self, msg: &CompletionMessage) -> StoreResult<()>;
}

#[derive(Clone)]
pub struct AppState {
    pub token_store:     Arc<dyn TokenStorePort>,
    pub execution_store: Arc<dyn ExecutionStorePort>,
    pub tx:              broadcast::Sender<WorkerMessage>,
}

impl AppState {
    pub fn new<TS, ES>(token_store: TS, execution_store: ES) -> Self
    where
        TS: TokenStorePort + 'static,
        ES: ExecutionStorePort + 'static,
    {
        Self::from_shared(Arc::new(token_store), Arc::new(execution_store))
    }

    pub fn from_shared(
        token_store: Arc<dyn TokenStorePort>,
        execution_store: Arc<dyn ExecutionStorePort>,
    ) -> Self {
        let (tx, _) = broadcast::channel(100);
        Self { token_store, execution_store, tx }
    }
}
