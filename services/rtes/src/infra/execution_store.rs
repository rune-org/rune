use chrono::Utc;
use mongodb::{
    Client as MongoClient,
    Collection,
    bson::{self, doc},
    options::ClientOptions,
};
use tracing::info;

use crate::domain::models::{
    CompletionMessage,
    ExecutionDocument,
    NodeExecutionInstance,
    NodeExecutionMessage,
    NodeStatusMessage,
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

    pub(crate) async fn update_node_status(
        &self,
        msg: &NodeStatusMessage,
    ) -> Result<(), mongodb::error::Error> {
        info!(
            execution_id = %msg.execution_id,
            workflow_id = %msg.workflow_id,
            node_id = %msg.node_id,
            status = %msg.status,
            lineage_hash = %msg.lineage_hash.as_deref().unwrap_or("default"),
            mongodb_db = %self.db_name,
            "Updating node status"
        );
        let filter = doc! {
            "execution_id": &msg.execution_id,
        };

        let lineage_hash = msg
            .lineage_hash
            .clone()
            .unwrap_or_else(|| "default".to_string());
        
        let mut update_path = format!("nodes.{}", msg.node_id);
        if lineage_hash != "default" {
            update_path = format!("{update_path}.lineages.{lineage_hash}");
        }

        let node_execution = NodeExecutionInstance {
            input:         msg.input.clone(),
            parameters:    msg.parameters.clone(),
            output:        msg.output.clone(),
            status:        Some(msg.status.clone()),
            error:         msg.error.clone(),
            executed_at:   Some(msg.executed_at.clone()),
            duration_ms:   Some(msg.duration_ms),
            lineage_hash:  msg.lineage_hash.clone(),
            lineage_stack: msg.lineage_stack.clone(),
            used_inputs:   msg.used_inputs.clone(),
        };

        let update = doc! {
            "$set": {
                update_path: bson::to_bson(&node_execution)?,
                "updated_at": bson::DateTime::from_millis(Utc::now().timestamp_millis()),
            }
        };

        self.execution_collection()
            .update_one(filter, update)
            .upsert(true)
            .await?;

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

        self.execution_collection()
            .update_one(filter, update)
            .upsert(true)
            .await?;
        info!(execution_id = %msg.execution_id, status = %msg.status, "Completed execution");
        Ok(())
    }
}
