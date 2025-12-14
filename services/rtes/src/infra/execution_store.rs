use chrono::Utc;
use mongodb::{
    Client as MongoClient,
    Collection,
    bson::{self, doc},
    options::ClientOptions,
};
use serde_json::{Map, Value};
use tracing::{info, warn};

use crate::{
    domain::models::{
        CompletionMessage,
        ExecutionDocument,
        NodeExecutionInstance,
        NodeExecutionMessage,
        NodeStatusMessage,
        compute_lineage_hash,
    },
    retry_backoff,
};

#[derive(Clone)]
pub(crate) struct ExecutionStore {
    client:  MongoClient,
    db_name: String,
}

impl ExecutionStore {
    pub(crate) async fn new(uri: &str, db_name: &str) -> Result<Self, mongodb::error::Error> {
        info!(mongodb_uri = %uri, mongodb_db = %db_name, "Connecting to MongoDB");
        let client_options = ClientOptions::parse(uri).await?;
        let client = MongoClient::with_options(client_options)?;
        info!(mongodb_db = %db_name, "MongoDB client initialized");
        Ok(Self { client, db_name: db_name.to_string() })
    }

    fn execution_collection(&self) -> Collection<ExecutionDocument> {
        self.client.database(&self.db_name).collection("executions")
    }

    pub(crate) async fn upsert_execution_definition(
        &self,
        msg: &NodeExecutionMessage,
    ) -> Result<(), mongodb::error::Error> {
        info!(
            execution_id = %msg.execution_id,
            workflow_id = %msg.workflow_id,
            mongodb_db = %self.db_name,
            "Upserting execution definition"
        );
        let now = bson::DateTime::from_millis(Utc::now().timestamp_millis());

        let normalized_workflow = normalize_workflow_definition(&msg.workflow_definition);
        let edges_bson = normalized_workflow
            .get("edges")
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new()));

        let mut nodes_doc = bson::Document::new();
        if let Some(Value::Array(nodes)) = normalized_workflow.get("nodes") {
            for node in nodes {
                if let Some(node_id) = node.get("id").and_then(Value::as_str)
                    && let Ok(node_bson) = bson::to_document(node)
                {
                    nodes_doc.insert(node_id.to_string(), bson::Bson::Document(node_bson.clone()));
                }
            }
        }

        let filter = doc! {
            "execution_id": &msg.execution_id,
        };

        let update = doc! {
            "$set": {
                "nodes": nodes_doc,
                "edges": bson::to_bson(&edges_bson)?,
                "accumulated_context": bson::to_bson(&msg.accumulated_context)?,
                "workflow_id": &msg.workflow_id,
                "execution_id": &msg.execution_id,
                "updated_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
            },
            "$unset": { "workflow_definition": "" },
        };

        self.execution_collection()
            .update_one(filter, update)
            .upsert(true)
            .await?;
        info!(execution_id = %msg.execution_id, "Upserted execution definition");
        Ok(())
    }

    pub(crate) async fn get_execution_document(
        &self,
        execution_id: &str,
    ) -> Result<Option<ExecutionDocument>, mongodb::error::Error> {
        info!(execution_id = %execution_id, mongodb_db = %self.db_name, "Fetching execution document");
        let filter = doc! { "execution_id": execution_id };
        let doc = self.execution_collection().find_one(filter).await?;
        info!(execution_id = %execution_id, found = doc.is_some(), "Fetched execution document");
        Ok(doc)
    }

    #[allow(clippy::too_many_lines)]
    pub(crate) async fn update_node_status(
        &self,
        msg: &NodeStatusMessage,
    ) -> Result<(), mongodb::error::Error> {
        let repair_pipeline = vec![doc! {
            "$set": {
                "nodes": {
                    "$cond": [
                        { "$isArray": "$nodes" },
                        bson::Document::new(),
                        "$nodes"
                    ]
                }
            }
        }];

        let computed_lineage_hash = msg
            .lineage_stack
            .as_ref()
            .filter(|stack| !stack.is_empty())
            .and_then(|stack| compute_lineage_hash(stack));

        let lineage_hash = computed_lineage_hash
            .or_else(|| msg.lineage_hash.clone())
            .unwrap_or_else(|| "default".to_string());

        info!(
            execution_id = %msg.execution_id,
            workflow_id = %msg.workflow_id,
            node_id = %msg.node_id,
            status = %msg.status,
            lineage_hash = %lineage_hash,
            mongodb_db = %self.db_name,
            "Updating node status"
        );
        let filter = doc! {
            "execution_id": &msg.execution_id,
        };

        let base_path = format!("nodes.{}", msg.node_id);

        let doc = retry_backoff!("get_execution_document", {
            self.get_execution_document(&msg.execution_id).await
        })
        .await?;

        let Some(doc) = doc else {
            warn!(
                execution_id = %msg.execution_id,
                node_id = %msg.node_id,
                "Execution document not found; cannot update node status"
            );
            return Ok(());
        };

        let (node_name, node_type) = doc.nodes.get(&msg.node_id).map_or((None, None), |n| {
            let name = n.latest.as_ref().and_then(|l| l.name.clone()).or_else(|| {
                n.extra
                    .get("name")
                    .and_then(Value::as_str)
                    .map(String::from)
            });
            let node_type = n
                .latest
                .as_ref()
                .and_then(|l| l.node_type.clone())
                .or_else(|| {
                    n.extra
                        .get("type")
                        .and_then(Value::as_str)
                        .map(String::from)
                });
            (name, node_type)
        });
        let node_execution = NodeExecutionInstance {
            input: msg.input.clone(),
            parameters: msg.parameters.clone(),
            output: msg.output.clone(),
            status: Some(msg.status.clone()),
            error: msg.error.clone(),
            executed_at: Some(msg.executed_at.clone()),
            duration_ms: Some(msg.duration_ms),
            node_type,
            name: node_name,
            lineage_hash: if lineage_hash == "default" {
                None
            } else {
                Some(lineage_hash.clone())
            },
            lineage_stack: msg.lineage_stack.clone(),
            used_inputs: msg.used_inputs.clone(),
            branch_id: msg.branch_id.clone(),
            split_node_id: msg.split_node_id.clone(),
            item_index: msg.item_index,
            total_items: msg.total_items,
            processed_count: msg.processed_count,
            aggregator_state: msg.aggregator_state.clone(),
        };

        let mut set_fields = doc! {
            format!("{base_path}.latest"): bson::to_bson(&node_execution)?,
            "updated_at": bson::DateTime::from_millis(Utc::now().timestamp_millis()),
        };

        if lineage_hash != "default" {
            set_fields.insert(
                format!("{base_path}.lineages.{lineage_hash}"),
                bson::to_bson(&node_execution)?,
            );
        }

        let update = doc! { "$set": set_fields };

        let max_retries: u32 = 5;
        let mut backoff = std::time::Duration::from_millis(250);

        for attempt in 0..=max_retries {
            if let Err(e) = self
                .execution_collection()
                .update_one(doc! { "execution_id": &msg.execution_id }, repair_pipeline.clone())
                .await
            {
                if attempt == max_retries {
                    return Err(e);
                }
                warn!(
                    execution_id = %msg.execution_id,
                    attempt = attempt + 1,
                    backoff_ms = backoff.as_millis(),
                    "Node status repair failed; will retry with backoff"
                );
                tokio::time::sleep(backoff).await;
                backoff = backoff.saturating_mul(2);
                continue;
            }

            match self
                .execution_collection()
                .update_one(filter.clone(), update.clone())
                .upsert(false)
                .await
            {
                Ok(_) => break,
                Err(e) => {
                    if attempt == max_retries {
                        return Err(e);
                    }
                    warn!(
                        execution_id = %msg.execution_id,
                        node_id = %msg.node_id,
                        attempt = attempt + 1,
                        backoff_ms = backoff.as_millis(),
                        "Node status update failed; will retry with backoff"
                    );
                    tokio::time::sleep(backoff).await;
                    backoff = backoff.saturating_mul(2);
                },
            }
        }

        info!(
            execution_id = %msg.execution_id,
            node_id = %msg.node_id,
            status = %msg.status,
            "Updated node status"
        );
        Ok(())
    }

    pub(crate) async fn complete_execution(
        &self,
        msg: &CompletionMessage,
    ) -> Result<(), mongodb::error::Error> {
        info!(
            execution_id = %msg.execution_id,
            workflow_id = %msg.workflow_id,
            status = %msg.status,
            mongodb_db = %self.db_name,
            "Completing execution"
        );
        let filter = doc! {
            "execution_id": &msg.execution_id,
        };

        let update = doc! {
            "$set": {
                "status": &msg.status,
                "updated_at": bson::DateTime::from_millis(Utc::now().timestamp_millis()),
            }
        };

        let max_retries: u32 = 5;
        let mut backoff = std::time::Duration::from_secs(1);

        for attempt in 0..=max_retries {
            let result = self
                .execution_collection()
                .update_one(filter.clone(), update.clone())
                .upsert(false)
                .await?;

            if result.matched_count > 0 {
                break;
            }

            if attempt == max_retries {
                warn!(
                    execution_id = %msg.execution_id,
                    workflow_id = %msg.workflow_id,
                    "Completion received for missing execution document; retries exhausted; execution document still missing"
                );
                return Ok(());
            }

            warn!(
            execution_id = %msg.execution_id,
            workflow_id = %msg.workflow_id,
            attempt = attempt + 1,
            backoff_ms = backoff.as_millis(),
            "Completion received for missing execution document; will retry with exponential backoff"
            );

            tokio::time::sleep(backoff).await;
            backoff = backoff.saturating_mul(2);
        }
        info!(execution_id = %msg.execution_id, status = %msg.status, "Completed execution");
        Ok(())
    }
}

fn normalize_workflow_definition(raw: &Value) -> Value {
    let mut workflow = raw.as_object().cloned().unwrap_or_default();

    let edges = normalize_edges(raw.get("edges"));
    workflow.insert("edges".to_string(), Value::Array(edges));

    let nodes_value = raw
        .get("nodes")
        .cloned()
        .unwrap_or_else(|| Value::Array(vec![]));
    let nodes = normalize_nodes(nodes_value);
    workflow.insert("nodes".to_string(), Value::Array(nodes));

    Value::Object(workflow)
}

fn normalize_edges(raw_edges: Option<&Value>) -> Vec<Value> {
    match raw_edges {
        Some(Value::Array(edges)) => edges.iter().map(normalize_edge).collect(),
        Some(Value::Object(map)) => map
            .iter()
            .map(|(edge_id, edge_val)| normalize_edge_with_id(edge_val, Some(edge_id)))
            .collect(),
        _ => Vec::new(),
    }
}

fn normalize_edge(edge: &Value) -> Value {
    normalize_edge_with_id(edge, None)
}

fn normalize_edge_with_id(edge: &Value, fallback_id: Option<&str>) -> Value {
    let mut normalized: Map<String, Value> = Map::new();
    let obj = edge.as_object();

    let id = obj
        .and_then(|o| o.get("id").and_then(Value::as_str))
        .map(str::to_string)
        .or_else(|| fallback_id.map(String::from))
        .unwrap_or_default();

    let src = obj
        .and_then(|o| o.get("src").and_then(Value::as_str))
        .unwrap_or_default()
        .to_string();

    let dst = obj
        .and_then(|o| o.get("dst").and_then(Value::as_str))
        .unwrap_or_default()
        .to_string();

    normalized.insert("id".to_string(), Value::String(id));
    normalized.insert("src".to_string(), Value::String(src));
    normalized.insert("dst".to_string(), Value::String(dst));

    if let Some(o) = obj {
        for (k, v) in o {
            if !normalized.contains_key(k) {
                normalized.insert(k.clone(), v.clone());
            }
        }
    }

    Value::Object(normalized)
}

fn normalize_nodes(raw_nodes: Value) -> Vec<Value> {
    match raw_nodes {
        Value::Array(nodes) => nodes.into_iter().map(normalize_node).collect(),
        Value::Object(map) => map
            .into_iter()
            .map(|(id, node_val)| {
                let mut node_map = Map::new();
                node_map.insert("id".to_string(), Value::String(id));
                if let Value::Object(obj) = node_val {
                    node_map.extend(obj);
                }
                normalize_node(Value::Object(node_map))
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn normalize_node(node_val: Value) -> Value {
    let mut normalized: Map<String, Value> = Map::new();

    normalized.insert("id".to_string(), Value::String(String::new()));
    normalized.insert("name".to_string(), Value::String(String::new()));
    normalized.insert("trigger".to_string(), Value::Bool(false));
    normalized.insert("type".to_string(), Value::String(String::new()));
    normalized.insert("parameters".to_string(), Value::Object(Map::new()));
    normalized.insert("output".to_string(), Value::Object(Map::new()));
    normalized.insert("credentials".to_string(), Value::Null);
    normalized.insert("error".to_string(), Value::Null);

    if let Value::Object(obj) = node_val {
        for (k, v) in obj {
            normalized.insert(k, v);
        }
    }

    let id = normalized
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    normalized.insert("id".to_string(), Value::String(id));

    let name = normalized
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    normalized.insert("name".to_string(), Value::String(name));

    let node_type = normalized
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    normalized.insert("type".to_string(), Value::String(node_type));

    let trigger = normalized
        .get("trigger")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    normalized.insert("trigger".to_string(), Value::Bool(trigger));

    let parameters = normalized
        .get("parameters")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    normalized.insert("parameters".to_string(), Value::Object(parameters));

    let output = normalized
        .get("output")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    normalized.insert("output".to_string(), Value::Object(output));

    if normalized.contains_key("credentials") {
        normalized.insert("credentials".to_string(), Value::Null);
    }

    if !normalized.contains_key("error") {
        normalized.insert("error".to_string(), Value::Null);
    }

    Value::Object(normalized)
}
