use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use async_trait::async_trait;
use rtes::{
    api::state::{AppState, ExecutionStorePort, StoreResult, TokenStorePort},
    config::Config,
    domain::models::{
        CompletionMessage,
        ExecutionDocument,
        ExecutionToken,
        HydratedNode,
        NodeExecutionInstance,
        NodeExecutionMessage,
        NodeStatusMessage,
    },
};

#[derive(Default)]
pub(crate) struct MockTokenStore {
    pub validate_access_result: bool,
    pub validate_access_for_execution_result: bool,
    pub validate_execution_access_result: bool,
    pub validate_workflow_access_result: bool,
    pub added_tokens: Mutex<Vec<ExecutionToken>>,
}

#[async_trait]
impl TokenStorePort for MockTokenStore {
    async fn add_token(&self, token: &ExecutionToken) -> StoreResult<()> {
        let mut guard = self
            .added_tokens
            .lock()
            .expect("mock token store mutex should not be poisoned");
        guard.push(token.clone());
        Ok(())
    }

    async fn validate_access(
        &self,
        _user_id: &str,
        _target_execution_id: Option<&str>,
        _target_workflow_id: &str,
    ) -> StoreResult<bool> {
        Ok(self.validate_access_result)
    }

    async fn validate_access_for_execution(
        &self,
        _user_id: &str,
        _target_execution_id: &str,
    ) -> StoreResult<bool> {
        Ok(self.validate_access_for_execution_result)
    }

    async fn validate_execution_access(
        &self,
        _target_execution_id: &str,
        _target_workflow_id: &str,
    ) -> StoreResult<bool> {
        Ok(self.validate_execution_access_result)
    }

    async fn validate_workflow_access(&self, _target_workflow_id: &str) -> StoreResult<bool> {
        Ok(self.validate_workflow_access_result)
    }
}

#[derive(Default)]
pub(crate) struct MockExecutionStore {
    pub execution_documents_by_id: Mutex<HashMap<String, ExecutionDocument>>,
    pub executions_by_workflow:    Mutex<HashMap<String, Vec<ExecutionDocument>>>,
}

#[async_trait]
impl ExecutionStorePort for MockExecutionStore {
    async fn upsert_execution_definition(&self, _msg: &NodeExecutionMessage) -> StoreResult<()> {
        Ok(())
    }

    async fn get_execution_document(
        &self,
        execution_id: &str,
    ) -> StoreResult<Option<ExecutionDocument>> {
        let guard = self
            .execution_documents_by_id
            .lock()
            .expect("mock execution store mutex should not be poisoned");
        Ok(guard.get(execution_id).cloned())
    }

    async fn get_executions_for_workflow(
        &self,
        workflow_id: &str,
    ) -> StoreResult<Vec<ExecutionDocument>> {
        let guard = self
            .executions_by_workflow
            .lock()
            .expect("mock execution store mutex should not be poisoned");
        Ok(guard.get(workflow_id).cloned().unwrap_or_default())
    }

    async fn update_node_status(&self, _msg: &NodeStatusMessage) -> StoreResult<()> {
        Ok(())
    }

    async fn complete_execution(&self, _msg: &CompletionMessage) -> StoreResult<()> {
        Ok(())
    }
}

pub(crate) fn init_test_config() {
    let _ = Config::init();
}

pub(crate) fn sample_execution(
    execution_id: &str,
    workflow_id: &str,
    status: Option<&str>,
) -> ExecutionDocument {
    let mut nodes = HashMap::new();
    nodes.insert(
        "node-1".to_string(),
        HydratedNode {
            latest: Some(NodeExecutionInstance {
                status: Some("success".to_string()),
                ..NodeExecutionInstance::default()
            }),
            ..HydratedNode::default()
        },
    );

    ExecutionDocument {
        execution_id: execution_id.to_string(),
        workflow_id: workflow_id.to_string(),
        nodes,
        status: status.map(ToOwned::to_owned),
        ..ExecutionDocument::default()
    }
}

pub(crate) fn build_state(
    token_store: Arc<MockTokenStore>,
    execution_store: Arc<MockExecutionStore>,
) -> AppState {
    let token_store_dyn: Arc<dyn TokenStorePort> = token_store;
    let execution_store_dyn: Arc<dyn ExecutionStorePort> = execution_store;
    AppState::from_shared(token_store_dyn, execution_store_dyn)
}
