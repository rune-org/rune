use std::time::{SystemTime, UNIX_EPOCH};

use redis::{AsyncCommands, Client as RedisClient, RedisResult};
use tracing::info;

use crate::domain::models::ExecutionToken;

#[derive(Clone)]
pub(crate) struct TokenStore {
    client: RedisClient,
}

impl TokenStore {
    pub(crate) const fn new(client: RedisClient) -> Self {
        Self { client }
    }

    fn get_user_key(user_id: &str) -> String {
        format!("user_id_{user_id}")
    }

    fn get_execution_key(execution_id: &str) -> String {
        format!("execution_id_{execution_id}")
    }

    fn get_workflow_key(workflow_id: &str) -> String {
        format!("workflow_id_{workflow_id}")
    }

    pub(crate) async fn add_token(&self, token: &ExecutionToken) -> RedisResult<()> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let member = serde_json::to_string(token).map_err(|e| {
            redis::RedisError::from(std::io::Error::new(std::io::ErrorKind::InvalidData, e))
        })?;

        // Index by user_id
        let user_key = Self::get_user_key(&token.user_id);
        let _: i64 = conn.zadd(&user_key, &member, token.exp).await?;
        self.ensure_key_ttl(&mut conn, &user_key, token.exp).await?;

        // Also index by execution_id if present (for WebSocket auth without JWT)
        if let Some(execution_id) = &token.execution_id {
            let exec_key = Self::get_execution_key(execution_id);
            let _: i64 = conn.zadd(&exec_key, &member, token.exp).await?;
            self.ensure_key_ttl(&mut conn, &exec_key, token.exp).await?;
        }

        // Also index by workflow_id for wildcard tokens (for HTTP history without JWT)
        if token.execution_id.is_none() {
            let wf_key = Self::get_workflow_key(&token.workflow_id);
            let _: i64 = conn.zadd(&wf_key, &member, token.exp).await?;
            self.ensure_key_ttl(&mut conn, &wf_key, token.exp).await?;
        }

        Ok(())
    }

    pub(crate) async fn validate_access(
        &self,
        user_id: &str,
        target_execution_id: Option<&str>,
        target_workflow_id: &str,
    ) -> RedisResult<bool> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let key = Self::get_user_key(user_id);

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

        info!(
            "Token executionId: {}, Target executionId: {}",
            token.execution_id.as_deref().unwrap_or("None"),
            target_execution_id.unwrap_or("None")
        );
        match (target_execution_id, token.execution_id.as_deref()) {
            (Some(req_eid), Some(tok_eid)) => *req_eid == *tok_eid,
            (Some(_) | None, None) => true,
            (None, Some(_)) => false,
        }
    }

    /// Validate access for a specific execution (simpler version for WebSocket)
    /// Checks if user has a grant for the given execution_id
    #[allow(dead_code)]
    pub(crate) async fn validate_access_for_execution(
        &self,
        user_id: &str,
        target_execution_id: &str,
    ) -> RedisResult<bool> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let key = Self::get_user_key(user_id);

        self.remove_expired_tokens(&mut conn, &key).await?;

        let tokens = self.fetch_valid_tokens(&mut conn, &key).await?;

        for token_str in tokens {
            if let Ok(token) = serde_json::from_str::<ExecutionToken>(&token_str) {
                // Match if: execution matches exactly, OR token has wildcard (None execution)
                let matches = match token.execution_id.as_deref() {
                    Some(tok_eid) => tok_eid == target_execution_id,
                    None => true, // Wildcard grant for workflow
                };
                if matches {
                    info!("Access granted for user {} execution {}", user_id, target_execution_id);
                    return Ok(true);
                }
            }
        }

        info!("Access denied for user {} execution {} - no matching grant found", user_id, target_execution_id);
        Ok(false)
    }

    /// Validate access by execution_id only (for WebSocket without JWT)
    /// Looks up token directly by execution_id index
    pub(crate) async fn validate_execution_access(
        &self,
        target_execution_id: &str,
        target_workflow_id: &str,
    ) -> RedisResult<bool> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let key = Self::get_execution_key(target_execution_id);

        self.remove_expired_tokens(&mut conn, &key).await?;

        let tokens = self.fetch_valid_tokens(&mut conn, &key).await?;

        for token_str in tokens {
            if let Ok(token) = serde_json::from_str::<ExecutionToken>(&token_str) {
                // Verify workflow_id matches
                if token.workflow_id == target_workflow_id {
                    info!(
                        "Access granted for execution {} workflow {}",
                        target_execution_id, target_workflow_id
                    );
                    return Ok(true);
                }
            }
        }

        info!(
            "Access denied for execution {} workflow {} - no matching grant found",
            target_execution_id, target_workflow_id
        );
        Ok(false)
    }

    /// Validate access by workflow_id only (for HTTP endpoints without JWT)
    /// Looks up token directly by workflow_id index (wildcard tokens)
    pub(crate) async fn validate_workflow_access(
        &self,
        target_workflow_id: &str,
    ) -> RedisResult<bool> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let key = Self::get_workflow_key(target_workflow_id);

        self.remove_expired_tokens(&mut conn, &key).await?;

        let tokens = self.fetch_valid_tokens(&mut conn, &key).await?;

        if !tokens.is_empty() {
            info!(
                "Access granted for workflow {} - found {} valid token(s)",
                target_workflow_id,
                tokens.len()
            );
            return Ok(true);
        }

        info!(
            "Access denied for workflow {} - no matching grant found",
            target_workflow_id
        );
        Ok(false)
    }
}

