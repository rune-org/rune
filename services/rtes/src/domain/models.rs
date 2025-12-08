use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ExecutionToken {
    pub execution_id: Option<String>,
    pub workflow_id: String,
    pub iat: i64,
    pub exp: i64,
    pub user_id: String,
}
