#![allow(unreachable_pub)]

use mongodb::bson::DateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// Execution context for branch / loop tracking.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
pub struct StackFrame {
    pub split_node_id: String,
    pub branch_id:     String,
    pub item_index:    i32,
    pub total_items:   i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ExecutionToken {
    pub execution_id: Option<String>,
    pub workflow_id:  String,
    pub iat:          i64,
    pub exp:          i64,
    pub user_id:      String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[allow(clippy::derive_partial_eq_without_eq)]
pub struct NodeError {
    pub message: String,
    pub code:    String,
    pub details: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct NodeStatusMessage {
    pub workflow_id:      String,
    pub execution_id:     String,
    pub node_id:          String,
    pub node_name:        String,
    pub status:           String, // "running", "success", "failed", "waiting"
    pub input:            Option<Value>,
    pub parameters:       Option<Value>,
    pub output:           Option<Value>,
    pub error:            Option<NodeError>,
    pub executed_at:      String,
    pub duration_ms:      i64,
    pub branch_id:        Option<String>,
    pub split_node_id:    Option<String>,
    pub item_index:       Option<i32>,
    pub total_items:      Option<i32>,
    pub processed_count:  Option<i32>,
    pub aggregator_state: Option<String>,
    pub lineage_stack:    Option<Vec<StackFrame>>,
    pub lineage_hash:     Option<String>,
    pub used_inputs:      Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[allow(clippy::derive_partial_eq_without_eq)]
pub struct CompletionMessage {
    pub workflow_id:       String,
    pub execution_id:      String,
    pub status:            String, // "completed", "failed", "halted"
    pub final_context:     Value,
    pub completed_at:      String,
    pub total_duration_ms: i64,
    pub failure_reason:    Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[allow(clippy::derive_partial_eq_without_eq)]
pub struct NodeExecutionMessage {
    pub workflow_id:         String,
    pub execution_id:        String,
    pub current_node:        String,
    pub workflow_definition: Value,
    pub accumulated_context: Value,
    pub lineage_stack:       Option<Vec<StackFrame>>,
    pub from_node:           Option<String>,
    pub is_worker_initiated: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(tag = "type")]
pub enum WorkerMessage {
    NodeStatus(Box<NodeStatusMessage>),
    WorkflowCompletion(Box<CompletionMessage>),
    NodeExecution(Box<NodeExecutionMessage>),
}

/// A single execution instance for a node, keyed by lineage_hash.
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct NodeExecutionInstance {
    pub input:         Option<Value>,
    pub parameters:    Option<Value>,
    pub output:        Option<Value>,
    pub status:        Option<String>,
    pub error:         Option<NodeError>,
    pub executed_at:   Option<String>,
    pub duration_ms:   Option<i64>,
    pub lineage_hash:  Option<String>,
    pub lineage_stack: Option<Vec<StackFrame>>,
    pub used_inputs:   Option<Value>,
}

/// Node-level executions mapped by lineage.
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct HydratedNode {
    #[serde(default)]
    pub executions: std::collections::HashMap<String, NodeExecutionInstance>,
}

/// Stored hydrated execution document.
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct ExecutionDocument {
    pub execution_id:        String,
    pub workflow_id:         String,
    pub workflow_definition: Value,
    #[serde(default)]
    pub accumulated_context: Value,
    #[serde(default)]
    pub nodes:               std::collections::HashMap<String, HydratedNode>,
    pub status:              Option<String>,
    pub created_at:          Option<DateTime>,
    pub updated_at:          Option<DateTime>,
}

/// Deterministically hash a lineage stack for use as a stable key.
pub fn compute_lineage_hash(stack: &[StackFrame]) -> Option<String> {
    serde_json::to_vec(stack)
        .ok()
        .map(|bytes| Uuid::new_v5(&Uuid::NAMESPACE_OID, &bytes).to_string())
}

/// Offloaded per-lineage node data stored in execution_node_data collection.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
pub struct ExecutionNodeData {
    pub execution_id: String,
    pub workflow_id:  String,
    pub node_id:      String,
    pub lineage_hash: String,
    pub data:         NodeExecutionInstance,
}
