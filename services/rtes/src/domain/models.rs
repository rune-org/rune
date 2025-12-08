use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub(crate) struct ExecutionToken {
    pub(crate) execution_id: Option<String>,
    pub(crate) workflow_id:  String,
    pub(crate) iat:          i64,
    pub(crate) exp:          i64,
    pub(crate) user_id:      String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct NodeError {
    pub(crate) message: String,
    pub(crate) code:    String,
    pub(crate) details: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct NodeStatusMessage {
    pub(crate) workflow_id:      String,
    pub(crate) execution_id:     String,
    pub(crate) node_id:          String,
    pub(crate) node_name:        String,
    pub(crate) status:           String, // "running", "success", "failed", "waiting"
    pub(crate) input:            Option<Value>,
    pub(crate) parameters:       Option<Value>,
    pub(crate) output:           Option<Value>,
    pub(crate) error:            Option<NodeError>,
    pub(crate) executed_at:      String,
    pub(crate) duration_ms:      i64,
    pub(crate) branch_id:        Option<String>,
    pub(crate) split_node_id:    Option<String>,
    pub(crate) item_index:       Option<i32>,
    pub(crate) total_items:      Option<i32>,
    pub(crate) processed_count:  Option<i32>,
    pub(crate) aggregator_state: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct CompletionMessage {
    pub(crate) workflow_id:       String,
    pub(crate) execution_id:      String,
    pub(crate) status:            String, // "completed", "failed", "halted"
    pub(crate) final_context:     Value,
    pub(crate) completed_at:      String,
    pub(crate) total_duration_ms: i64,
    pub(crate) failure_reason:    Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct NodeExecutionMessage {
    pub(crate) workflow_id:         String,
    pub(crate) execution_id:        String,
    pub(crate) current_node:        String,
    pub(crate) accumulated_context: Value,
    pub(crate) from_node:           Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub(crate) enum WorkerMessage {
    NodeStatus(NodeStatusMessage),
    WorkflowCompletion(CompletionMessage),
    NodeExecution(NodeExecutionMessage),
}
