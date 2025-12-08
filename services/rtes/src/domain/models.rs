use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub(crate) struct ExecutionToken {
    pub(crate) execution_id: Option<String>,
    pub(crate) workflow_id:  String,
    pub(crate) iat:          i64,
    pub(crate) exp:          i64,
    pub(crate) user_id:      String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct ExecutionStatus {
    pub(crate) execution_id: String,
    pub(crate) status:       String, // e.g., "running", "completed", "failed"
    pub(crate) timestamp:    i64,
    pub(crate) details:      Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct ExecutionResult {
    pub(crate) execution_id: String,
    pub(crate) workflow_id:  String,
    pub(crate) status:       String,
    pub(crate) output:       Option<serde_json::Value>,
    pub(crate) error:        Option<String>,
    pub(crate) start_time:   i64,
    pub(crate) end_time:     i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub(crate) enum WorkerMessage {
    Status(ExecutionStatus),
    Result(ExecutionResult),
}
