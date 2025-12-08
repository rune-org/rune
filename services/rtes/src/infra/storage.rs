use std::time::{SystemTime, UNIX_EPOCH};

use mongodb::{Client as MongoClient, Collection, options::ClientOptions};
use redis::{AsyncCommands, Client as RedisClient, RedisResult};

use crate::domain::models::{ExecutionResult, ExecutionStatus, ExecutionToken};

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

    fn status_collection(&self) -> Collection<ExecutionStatus> {
        self.client
            .database(&self.db_name)
            .collection("execution_status")
    }

    fn result_collection(&self) -> Collection<ExecutionResult> {
        self.client
            .database(&self.db_name)
            .collection("execution_results")
    }

    pub(crate) async fn save_status(
        &self,
        status: &ExecutionStatus,
    ) -> Result<(), mongodb::error::Error> {
        self.status_collection().insert_one(status).await?;
        Ok(())
    }

    pub(crate) async fn save_result(
        &self,
        result: &ExecutionResult,
    ) -> Result<(), mongodb::error::Error> {
        self.result_collection().insert_one(result).await?;
        Ok(())
    }

    pub(crate) async fn get_status(
        &self,
        execution_id: &str,
        limit: i64,
        offset: u64,
    ) -> Result<Vec<ExecutionStatus>, mongodb::error::Error> {
        let filter = mongodb::bson::doc! { "execution_id": execution_id };
        let mut cursor = self.status_collection()
            .find(filter)
            .limit(limit)
            .skip(offset)
            .sort(mongodb::bson::doc! { "timestamp": 1 })
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
    ) -> Result<Option<ExecutionResult>, mongodb::error::Error> {
        let filter = mongodb::bson::doc! { "execution_id": execution_id };
        self.result_collection().find_one(filter).await
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
            .as_secs()
            .cast_signed();
        let _: i64 = conn.zrembyscore(key, "-inf", now).await?;
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
