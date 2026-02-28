#![allow(unreachable_pub)]

use std::collections::HashMap;

use mongodb::bson::DateTime;
use serde::{Deserialize, Serialize, de::Deserializer};
use serde_json::Value;
use uuid::Uuid;

/// Custom serialization for bson::DateTime to output ISO 8601 strings
mod datetime_iso {
    use mongodb::bson::DateTime;
    use serde::{self, Deserialize, Deserializer, Serializer};

    #[allow(clippy::ref_option)] // serde `with` requires &Option<T> signature
    pub fn serialize<S>(date: &Option<DateTime>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match date {
            Some(dt) => {
                let iso_string = dt.try_to_rfc3339_string().unwrap_or_default();
                serializer.serialize_some(&iso_string)
            },
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<DateTime>, D::Error>
    where
        D: Deserializer<'de>,
    {
        // Try to deserialize as string first (ISO format), fallback to BSON format
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum DateTimeFormat {
            IsoString(String),
            BsonDateTime(DateTime),
        }

        let opt: Option<DateTimeFormat> = Option::deserialize(deserializer)?;
        match opt {
            Some(DateTimeFormat::IsoString(s)) => DateTime::parse_rfc3339_str(&s)
                .map(Some)
                .map_err(serde::de::Error::custom),
            Some(DateTimeFormat::BsonDateTime(dt)) => Ok(Some(dt)),
            None => Ok(None),
        }
    }
}

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

/// Token payload consumed from RabbitMQ.
///
/// Supports legacy single-id fields (`execution_id`, `workflow_id`) and
/// multi-id fields (`execution_ids`, `workflow_ids`) for batch grants.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ExecutionTokenPayload {
    #[serde(default, alias = "executionId")]
    pub execution_id:  Option<String>,
    #[serde(default, alias = "executionIds")]
    pub execution_ids: Option<Vec<String>>,
    #[serde(default, alias = "workflowId")]
    pub workflow_id:   Option<String>,
    #[serde(default, alias = "workflowIds")]
    pub workflow_ids:  Option<Vec<String>>,
    pub iat:           i64,
    pub exp:           i64,
    pub user_id:       String,
}

impl ExecutionTokenPayload {
    fn normalize_ids(single: Option<String>, many: Option<Vec<String>>) -> Vec<String> {
        let mut ids = Vec::new();

        if let Some(value) = single {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                ids.push(trimmed.to_string());
            }
        }

        if let Some(values) = many {
            for value in values {
                let trimmed = value.trim();
                if !trimmed.is_empty() && !ids.iter().any(|existing| existing == trimmed) {
                    ids.push(trimmed.to_string());
                }
            }
        }

        ids
    }

    pub fn expand(self) -> Result<Vec<ExecutionToken>, &'static str> {
        let workflow_ids = Self::normalize_ids(self.workflow_id, self.workflow_ids);
        if workflow_ids.is_empty() {
            return Err("token payload must include workflow_id or workflow_ids");
        }

        let execution_ids = Self::normalize_ids(self.execution_id, self.execution_ids);

        let mut tokens = Vec::new();
        if execution_ids.is_empty() {
            for workflow_id in workflow_ids {
                tokens.push(ExecutionToken {
                    execution_id: None,
                    workflow_id,
                    iat: self.iat,
                    exp: self.exp,
                    user_id: self.user_id.clone(),
                });
            }
            return Ok(tokens);
        }

        for workflow_id in workflow_ids {
            for execution_id in &execution_ids {
                tokens.push(ExecutionToken {
                    execution_id: Some(execution_id.clone()),
                    workflow_id:  workflow_id.clone(),
                    iat:          self.iat,
                    exp:          self.exp,
                    user_id:      self.user_id.clone(),
                });
            }
        }

        Ok(tokens)
    }
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
    pub input:            Option<Value>,
    pub parameters:       Option<Value>,
    pub output:           Option<Value>,
    pub status:           Option<String>,
    pub error:            Option<NodeError>,
    pub executed_at:      Option<String>,
    pub duration_ms:      Option<i64>,
    pub lineage_hash:     Option<String>,
    pub lineage_stack:    Option<Vec<StackFrame>>,
    pub used_inputs:      Option<Value>,
    pub node_type:        Option<String>,
    pub name:             Option<String>,
    #[serde(default)]
    pub branch_id:        Option<String>,
    #[serde(default)]
    pub split_node_id:    Option<String>,
    #[serde(default)]
    pub item_index:       Option<i32>,
    #[serde(default)]
    pub total_items:      Option<i32>,
    #[serde(default)]
    pub processed_count:  Option<i32>,
    #[serde(default)]
    pub aggregator_state: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct HydratedNode {
    #[serde(default)]
    pub latest:   Option<NodeExecutionInstance>,
    #[serde(default)]
    pub lineages: HashMap<String, NodeExecutionInstance>,
    #[serde(flatten, default)]
    pub extra:    HashMap<String, Value>,
}

/// Stored hydrated execution document.
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct ExecutionDocument {
    pub execution_id:        String,
    pub workflow_id:         String,
    #[serde(default)]
    pub workflow_definition: Value,
    #[serde(default)]
    pub accumulated_context: Value,
    #[serde(default, deserialize_with = "deserialize_nodes")]
    pub nodes:               HashMap<String, HydratedNode>,
    #[serde(default)]
    pub edges:               Vec<Value>,
    pub status:              Option<String>,
    pub name:                Option<String>,
    pub node_type:           Option<String>,
    #[serde(default, with = "datetime_iso")]
    pub created_at:          Option<DateTime>,
    #[serde(default, with = "datetime_iso")]
    pub updated_at:          Option<DateTime>,
}

/// Deterministically hash a lineage stack for use as a stable key.
pub fn compute_lineage_hash(stack: &[StackFrame]) -> Option<String> {
    serde_json::to_vec(stack)
        .ok()
        .map(|bytes| Uuid::new_v5(&Uuid::NAMESPACE_OID, &bytes).to_string())
}

fn deserialize_nodes<'de, D>(deserializer: D) -> Result<HashMap<String, HydratedNode>, D::Error>
where
    D: Deserializer<'de>,
{
    let raw: HashMap<String, Value> = HashMap::deserialize(deserializer)?;
    let mut result: HashMap<String, HydratedNode> = HashMap::new();

    for (node_id, value) in raw {
        let hydrated = match value {
            Value::Object(obj) => {
                if obj.contains_key("lineages") || obj.contains_key("latest") {
                    let latest: Option<NodeExecutionInstance> = obj
                        .get("latest")
                        .cloned()
                        .and_then(|v| serde_json::from_value(v).ok());

                    let lineages: HashMap<String, NodeExecutionInstance> = obj
                        .get("lineages")
                        .cloned()
                        .and_then(|v| serde_json::from_value(v).ok())
                        .unwrap_or_default();

                    let mut extra = obj.clone().into_iter().collect::<HashMap<_, _>>();
                    extra.remove("latest");
                    extra.remove("lineages");

                    HydratedNode { latest, lineages, extra }
                } else {
                    let extra_map = obj.into_iter().collect::<HashMap<_, _>>();
                    serde_json::from_value::<NodeExecutionInstance>(
                        Value::Object(extra_map.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                    )
                    .ok()
                    .filter(|inst| inst.status.is_some())
                    .map_or_else(
                        || HydratedNode {
                            latest:   None,
                            lineages: HashMap::new(),
                            extra:    extra_map,
                        },
                        |instance| HydratedNode {
                            latest:   Some(instance),
                            lineages: HashMap::new(),
                            extra:    HashMap::new(),
                        },
                    )
                }
            },
            other => serde_json::from_value::<NodeExecutionInstance>(other.clone()).map_or_else(
                |_| HydratedNode {
                    latest:   None,
                    lineages: HashMap::new(),
                    extra:    HashMap::new(),
                },
                |instance| HydratedNode {
                    latest:   Some(instance),
                    lineages: HashMap::new(),
                    extra:    HashMap::new(),
                },
            ),
        };
        result.insert(node_id, hydrated);
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{ExecutionTokenPayload, StackFrame, compute_lineage_hash};

    #[test]
    fn expands_legacy_single_token_payload() {
        let payload = ExecutionTokenPayload {
            execution_id:  Some("exec-1".to_string()),
            execution_ids: None,
            workflow_id:   Some("wf-1".to_string()),
            workflow_ids:  None,
            iat:           100,
            exp:           200,
            user_id:       "user-1".to_string(),
        };

        let expanded = payload.expand().expect("payload should be valid");
        assert_eq!(expanded.len(), 1);
        assert_eq!(expanded[0].execution_id.as_deref(), Some("exec-1"));
        assert_eq!(expanded[0].workflow_id, "wf-1");
    }

    #[test]
    fn expands_multi_id_payload_as_cross_product() {
        let payload = ExecutionTokenPayload {
            execution_id:  None,
            execution_ids: Some(vec!["exec-1".to_string(), "exec-2".to_string()]),
            workflow_id:   None,
            workflow_ids:  Some(vec!["wf-1".to_string(), "wf-2".to_string()]),
            iat:           100,
            exp:           200,
            user_id:       "user-1".to_string(),
        };

        let expanded = payload.expand().expect("payload should be valid");
        assert_eq!(expanded.len(), 4);
        assert!(
            expanded.iter().any(|token| token.workflow_id == "wf-1"
                && token.execution_id.as_deref() == Some("exec-1"))
        );
        assert!(
            expanded.iter().any(|token| token.workflow_id == "wf-2"
                && token.execution_id.as_deref() == Some("exec-2"))
        );
    }

    #[test]
    fn expands_wildcard_tokens_for_multiple_workflows() {
        let payload = ExecutionTokenPayload {
            execution_id:  None,
            execution_ids: None,
            workflow_id:   None,
            workflow_ids:  Some(vec!["wf-1".to_string(), "wf-2".to_string()]),
            iat:           100,
            exp:           200,
            user_id:       "user-1".to_string(),
        };

        let expanded = payload.expand().expect("payload should be valid");
        assert_eq!(expanded.len(), 2);
        assert!(expanded.iter().all(|token| token.execution_id.is_none()));
    }

    #[test]
    fn rejects_payload_without_any_workflow_id() {
        let payload = ExecutionTokenPayload {
            execution_id:  Some("exec-1".to_string()),
            execution_ids: None,
            workflow_id:   None,
            workflow_ids:  None,
            iat:           100,
            exp:           200,
            user_id:       "user-1".to_string(),
        };

        assert!(payload.expand().is_err());
    }

    #[test]
    fn deserializes_camel_case_payload_fields() {
        let payload: ExecutionTokenPayload = serde_json::from_value(json!({
            "executionIds": ["exec-1"],
            "workflowIds": ["wf-1"],
            "iat": 100,
            "exp": 200,
            "user_id": "user-1"
        }))
        .expect("camelCase token payload should deserialize");

        let expanded = payload.expand().expect("payload should expand");
        assert_eq!(expanded.len(), 1);
        assert_eq!(expanded[0].execution_id.as_deref(), Some("exec-1"));
        assert_eq!(expanded[0].workflow_id, "wf-1");
    }

    #[test]
    fn lineage_hash_is_deterministic() {
        let stack = vec![
            StackFrame {
                split_node_id: "split-1".to_string(),
                branch_id:     "branch-a".to_string(),
                item_index:    0,
                total_items:   2,
            },
            StackFrame {
                split_node_id: "split-2".to_string(),
                branch_id:     "branch-b".to_string(),
                item_index:    1,
                total_items:   3,
            },
        ];

        let first = compute_lineage_hash(&stack);
        let second = compute_lineage_hash(&stack);
        assert_eq!(first, second);
        assert!(first.is_some());
    }
}
