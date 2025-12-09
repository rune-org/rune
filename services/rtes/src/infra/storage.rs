use std::{
    collections::HashMap,
    time::{SystemTime, UNIX_EPOCH},
};

use chrono::Utc;
use futures::TryStreamExt;
use mongodb::{
    Client as MongoClient,
    Collection,
    bson::{self, doc},
    options::ClientOptions,
};
use redis::{AsyncCommands, Client as RedisClient, RedisResult};

use crate::domain::models::{
    CompletionMessage,
    ExecutionDocument,
    ExecutionNodeData,
    ExecutionToken,
    HydratedNode,
    NodeExecutionMessage,
    NodeStatusMessage,
    compute_lineage_hash,
};

#[derive(Clone)]
pub(crate) struct TokenStore {
    client: RedisClient,
}

#[derive(Clone)]
pub(crate) struct ExecutionStore {
    client:  MongoClient,
    db_name: String,
}

impl ExecutionStore {
    pub(crate) async fn new(uri: &str, db_name: &str) -> Result<Self, mongodb::error::Error> {
        let client_options = ClientOptions::parse(uri).await?;
        let client = MongoClient::with_options(client_options)?;
        Ok(Self { client, db_name: db_name.to_string() })
    }

    fn status_collection(&self) -> Collection<NodeStatusMessage> {
        self.client
            .database(&self.db_name)
            .collection("execution_status")
    }

    fn result_collection(&self) -> Collection<CompletionMessage> {
        self.client
            .database(&self.db_name)
            .collection("execution_results")
    }

    fn execution_collection(&self) -> Collection<ExecutionDocument> {
        self.client.database(&self.db_name).collection("executions")
    }

    fn execution_node_data_collection(&self) -> Collection<ExecutionNodeData> {
        self.client
            .database(&self.db_name)
            .collection("execution_node_data")
    }

    pub(crate) async fn save_status(
        &self,
        status: &NodeStatusMessage,
    ) -> Result<(), mongodb::error::Error> {
        self.upsert_node_execution(status).await?;
        self.status_collection().insert_one(status).await?;
        Ok(())
    }

    pub(crate) async fn save_result(
        &self,
        result: &CompletionMessage,
    ) -> Result<(), mongodb::error::Error> {
        self.result_collection().insert_one(result).await?;
        Ok(())
    }

    pub(crate) async fn upsert_execution_definition(
        &self,
        msg: &NodeExecutionMessage,
    ) -> Result<(), mongodb::error::Error> {
        let now = bson::DateTime::from_millis(Utc::now().timestamp_millis());

        let filter = doc! {
            "execution_id": &msg.execution_id,
        };

        let set_on_insert = doc! {
            "execution_id": &msg.execution_id,
            "workflow_id": &msg.workflow_id,
            "created_at": now,
        };

        let update = doc! {
            "$setOnInsert": set_on_insert,
            "$set": {
                "workflow_definition": bson::to_bson(&msg.workflow_definition)?,
                "accumulated_context": bson::to_bson(&msg.accumulated_context)?,
                "updated_at": now,
            }
        };

        self.execution_collection()
            .update_one(filter, update)
            .upsert(true)
            .await?;
        Ok(())
    }

    pub(crate) async fn upsert_node_execution(
        &self,
        status: &NodeStatusMessage,
    ) -> Result<(), mongodb::error::Error> {
        let now = bson::DateTime::from_millis(Utc::now().timestamp_millis());
        let lineage_hash = status.lineage_hash.as_ref().map_or_else(
            || {
                status
                    .lineage_stack
                    .as_ref()
                    .and_then(|stack| compute_lineage_hash(stack))
                    .unwrap_or_else(|| "root".to_string())
            },
            Clone::clone,
        );

        let executions_path = format!("nodes.{}.executions.{}", status.node_id, lineage_hash);

        let filter = doc! {
            "execution_id": &status.execution_id,
        };

        let set_on_insert = doc! {
            "execution_id": &status.execution_id,
            "workflow_id": &status.workflow_id,
            "nodes": bson::to_bson(&HashMap::<String, HydratedNode>::new())?,
            "created_at": now,
        };

        // Main doc stores only a lightweight pointer to keep size small.
        let update = doc! {
            "$setOnInsert": set_on_insert,
            "$set": {
                &executions_path: { "ref": true, "node_id": &status.node_id, "lineage_hash": &lineage_hash },
                "updated_at": now,
            }
        };

        self.execution_collection()
            .update_one(filter, update.clone())
            .upsert(true)
            .await?;

        // Offload the full node execution payload to execution_node_data collection.
        let node_data = ExecutionNodeData {
            execution_id: status.execution_id.clone(),
            workflow_id:  status.workflow_id.clone(),
            node_id:      status.node_id.clone(),
            lineage_hash: lineage_hash.clone(),
            data:         crate::domain::models::NodeExecutionInstance {
                input:         status.input.clone(),
                parameters:    status.parameters.clone(),
                output:        status.output.clone(),
                status:        Some(status.status.clone()),
                error:         status.error.clone(),
                executed_at:   Some(status.executed_at.clone()),
                duration_ms:   Some(status.duration_ms),
                lineage_hash:  Some(lineage_hash.clone()),
                lineage_stack: status.lineage_stack.clone(),
                used_inputs:   status.used_inputs.clone(),
            },
        };

        let node_filter = doc! {
            "execution_id": &node_data.execution_id,
            "node_id": &node_data.node_id,
            "lineage_hash": &node_data.lineage_hash,
        };

        let node_update = doc! {
            "$set": bson::to_bson(&node_data)?,
            "$setOnInsert": { "created_at": now },
            "$currentDate": { "updated_at": true },
        };

        self.execution_node_data_collection()
            .update_one(node_filter, node_update)
            .upsert(true)
            .await?;
        Ok(())
    }

    pub(crate) async fn get_status(
        &self,
        execution_id: &str,
        limit: i64,
        offset: u64,
    ) -> Result<Vec<NodeStatusMessage>, mongodb::error::Error> {
        let filter = mongodb::bson::doc! { "execution_id": execution_id };
        let mut cursor = self
            .status_collection()
            .find(filter)
            .limit(limit)
            .skip(offset)
            .sort(mongodb::bson::doc! { "executed_at": 1 })
            .await?;
        let mut statuses = Vec::new();
        while cursor.advance().await? {
            statuses.push(cursor.deserialize_current()?);
        }
        Ok(statuses)
    }

    pub(crate) async fn get_result(
        &self,
        execution_id: &str,
    ) -> Result<Option<CompletionMessage>, mongodb::error::Error> {
        let filter = mongodb::bson::doc! { "execution_id": execution_id };
        self.result_collection().find_one(filter).await
    }

    pub(crate) async fn get_execution_document(
        &self,
        execution_id: &str,
    ) -> Result<Option<ExecutionDocument>, mongodb::error::Error> {
        let filter = doc! { "execution_id": execution_id };
        let Some(mut doc) = self.execution_collection().find_one(filter).await? else {
            return Ok(None);
        };

        let mut nodes = HashMap::new();

        // Preserve any existing entries but prefer hydrated data when available.
        for (node_id, hydrated_node) in doc.nodes {
            nodes.insert(node_id, hydrated_node);
        }

        let mut cursor = self
            .execution_node_data_collection()
            .find(doc! { "execution_id": execution_id })
            .await?;

        while let Some(node_data) = cursor.try_next().await? {
            let entry = nodes
                .entry(node_data.node_id.clone())
                .or_insert_with(|| HydratedNode { executions: HashMap::new() });
            entry
                .executions
                .insert(node_data.lineage_hash.clone(), node_data.data.clone());
        }

        doc.nodes = nodes;
        Ok(Some(doc))
    }
}

impl TokenStore {
    pub(crate) const fn new(client: RedisClient) -> Self {
        Self { client }
    }

    fn get_key(user_id: &str) -> String {
        format!("user_id_{user_id}")
    }

    pub(crate) async fn add_token(&self, token: &ExecutionToken) -> RedisResult<()> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let key = Self::get_key(&token.user_id);
        let member = serde_json::to_string(token).map_err(|e| {
            redis::RedisError::from(std::io::Error::new(std::io::ErrorKind::InvalidData, e))
        })?;

        let _: i64 = conn.zadd(&key, member, token.exp).await?;
        self.ensure_key_ttl(&mut conn, &key, token.exp).await?;
        Ok(())
    }

    pub(crate) async fn validate_access(
        &self,
        user_id: &str,
        target_execution_id: Option<&str>,
        target_workflow_id: &str,
    ) -> RedisResult<bool> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let key = Self::get_key(user_id);

        self.remove_expired_tokens(&mut conn, &key).await?;

        let tokens = self.fetch_valid_tokens(&mut conn, &key).await?;

        for token_str in tokens {
            if let Ok(token) = serde_json::from_str::<ExecutionToken>(&token_str)
                && self.check_token_permissions(&token, target_execution_id, target_workflow_id)
            {
                return Ok(true);
            }
        }

        Ok(false)
    }

    async fn remove_expired_tokens(
        &self,
        conn: &mut redis::aio::MultiplexedConnection,
        key: &str,
    ) -> RedisResult<()> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let now = i64::try_from(now).unwrap_or(i64::MAX);
        let _: i64 = conn.zrembyscore(key, "-inf", now).await?;
        Ok(())
    }

    async fn ensure_key_ttl(
        &self,
        conn: &mut redis::aio::MultiplexedConnection,
        key: &str,
        exp_epoch_secs: i64,
    ) -> RedisResult<()> {
        let now_secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let now_secs = i64::try_from(now_secs).unwrap_or(i64::MAX);

        let expire_in = exp_epoch_secs.saturating_sub(now_secs);
        if expire_in <= 0 {
            // Token already expired; cleanup will remove it.
            return Ok(());
        }

        let ttl_secs: i32 = conn.ttl(key).await.unwrap_or(-2);
        if ttl_secs == -2 || i64::from(ttl_secs) < expire_in {
            let _: bool = conn.expire(key, expire_in).await?;
        }
        Ok(())
    }

    #[allow(dead_code)]
    async fn fetch_valid_tokens(
        &self,
        conn: &mut redis::aio::MultiplexedConnection,
        key: &str,
    ) -> RedisResult<Vec<String>> {
        conn.zrange(key, 0, -1).await
    }

    #[allow(clippy::unused_self)]
    fn check_token_permissions(
        &self,
        token: &ExecutionToken,
        target_execution_id: Option<&str>,
        target_workflow_id: &str,
    ) -> bool {
        if token.workflow_id != target_workflow_id {
            return false;
        }

        match (target_execution_id, &token.execution_id) {
            (Some(req_eid), Some(tok_eid)) => req_eid == tok_eid,
            (Some(_) | None, None) => true,
            (None, Some(_)) => false,
        }
    }
}
