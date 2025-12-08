use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub(crate) struct ExecutionToken {
    pub(crate) execution_id: Option<String>,
    pub(crate) workflow_id: String,
    pub(crate) iat: i64,
    pub(crate) exp: i64,
    pub(crate) user_id: String,
}
