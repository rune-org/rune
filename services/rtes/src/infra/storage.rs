use crate::domain::models::ExecutionToken;
use redis::{AsyncCommands, Client, RedisResult};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone)]
pub(crate) struct TokenStore {
    client: Client,
}

impl TokenStore {
    pub(crate) const fn new(client: Client) -> Self {
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

        // Add to ZSET with score = exp
        let _: i64 = conn.zadd(&key, member, token.exp).await?;
        Ok(())
    }

    #[allow(dead_code)]
    #[allow(clippy::collapsible_if)]
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
            if let Ok(token) = serde_json::from_str::<ExecutionToken>(&token_str) {
                if self.check_token_permissions(&token, target_execution_id, target_workflow_id) {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    #[allow(dead_code)]
    #[allow(clippy::cast_possible_wrap)]
    async fn remove_expired_tokens(
        &self,
        conn: &mut redis::aio::MultiplexedConnection,
        key: &str,
    ) -> RedisResult<()> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
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

    #[allow(dead_code)]
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
