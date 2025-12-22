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
                    serde_json::from_value::<NodeExecutionInstance>(Value::Object(obj.clone()))
                        .map_or_else(
                            |_| HydratedNode {
                                latest:   None,
                                lineages: HashMap::new(),
                                extra:    obj.into_iter().collect::<HashMap<_, _>>(),
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
