use std::sync::Arc;

use futures::StreamExt;
use lapin::{
    Channel,
    Connection,
    ConnectionProperties,
    ExchangeKind,
    options::{
        BasicAckOptions,
        BasicConsumeOptions,
        BasicNackOptions,
        BasicQosOptions,
        ExchangeDeclareOptions,
        QueueBindOptions,
        QueueDeclareOptions,
    },
    types::FieldTable,
};
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

use crate::{
    api::state::{AppState, TokenStorePort},
    domain::models::{
        CompletionMessage,
        ExecutionToken,
        ExecutionTokenPayload,
        NodeExecutionMessage,
        NodeStatusMessage,
        WorkerMessage,
    },
};

const EXCHANGE_NAME: &str = "workflows";

fn expand_tokens_from_payload(payload_bytes: &[u8]) -> Result<Vec<ExecutionToken>, String> {
    let payload = serde_json::from_slice::<ExecutionTokenPayload>(payload_bytes)
        .map_err(|e| format!("Failed to deserialize token payload: {e}"))?;
    payload.expand().map_err(ToOwned::to_owned)
}

fn declare_options(durable: bool) -> QueueDeclareOptions {
    QueueDeclareOptions { durable, ..QueueDeclareOptions::default() }
}

/// Declare the workflows exchange (topic) if it doesn't exist.
/// Note: durable must match the existing exchange created by the worker.
async fn declare_exchange(channel: &Channel) -> Result<(), Box<dyn std::error::Error>> {
    channel
        .exchange_declare(
            EXCHANGE_NAME,
            ExchangeKind::Topic,
            ExchangeDeclareOptions { durable: true, ..ExchangeDeclareOptions::default() },
            FieldTable::default(),
        )
        .await?;
    Ok(())
}

/// Bind a queue to the workflows exchange with the given routing key.
async fn bind_queue(
    channel: &Channel,
    queue_name: &str,
    routing_key: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    channel
        .queue_bind(
            queue_name,
            EXCHANGE_NAME,
            routing_key,
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;
    info!(
        "Bound queue '{}' to exchange '{}' with routing key '{}'",
        queue_name, EXCHANGE_NAME, routing_key
    );
    Ok(())
}

pub async fn start_token_consumer(
    amqp_addr: &str,
    token_store: Arc<dyn TokenStorePort>,
    cancel_token: CancellationToken,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::connect(amqp_addr, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    let cfg = crate::config::Config::get();
    let queue_name = &cfg.rabbitmq_token_queue;
    let consumer_tag = &cfg.rabbitmq_consumer_tag;
    let prefetch_count = cfg.rabbitmq_prefetch_count;
    let concurrent_messages = cfg.rabbitmq_concurrent_messages;

    channel
        .basic_qos(prefetch_count, BasicQosOptions::default())
        .await?;

    let _queue = channel
        .queue_declare(
            queue_name,
            declare_options(cfg.rabbitmq_queue_durable),
            FieldTable::default(),
        )
        .await?;

    let consumer = channel
        .basic_consume(
            queue_name,
            consumer_tag,
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    info!(
        "Started token consumer on queue: {} with prefetch: {} and concurrency: {}",
        queue_name, prefetch_count, concurrent_messages
    );

    consumer
        .take_until(cancel_token.cancelled())
        .for_each_concurrent(Some(concurrent_messages), |delivery| {
            let token_store = token_store.clone();
            async move {
                if let Ok(delivery) = delivery {
                    process_token_delivery(delivery, token_store.as_ref()).await;
                }
            }
        })
        .await;

    Ok(())
}

async fn process_token_delivery(
    delivery: lapin::message::Delivery,
    token_store: &dyn TokenStorePort,
) {
    match expand_tokens_from_payload(&delivery.data) {
        Ok(tokens) => {
            for token in &tokens {
                info!(
                    "Received token for user: {} workflow: {} execution: {}",
                    token.user_id,
                    token.workflow_id,
                    token.execution_id.as_deref().unwrap_or("*")
                );
                if let Err(e) = token_store.add_token(token).await {
                    error!("Failed to store token: {}", e);
                    let _ = delivery
                        .nack(BasicNackOptions { requeue: false, ..BasicNackOptions::default() })
                        .await;
                    return;
                }
            }
            let _ = delivery.ack(BasicAckOptions::default()).await;
        },
        Err(e) => {
            error!("{}", e);
            let _ = delivery
                .nack(BasicNackOptions { requeue: false, ..BasicNackOptions::default() })
                .await;
        },
    }
}

pub async fn start_execution_consumer(
    amqp_addr: &str,
    state: AppState,
    cancel_token: CancellationToken,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::connect(amqp_addr, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    let cfg = crate::config::Config::get();
    let queue_name = &cfg.rabbitmq_execution_queue;

    // Declare the workflows exchange
    declare_exchange(&channel).await?;

    let _queue = channel
        .queue_declare(
            queue_name,
            declare_options(cfg.rabbitmq_queue_durable),
            FieldTable::default(),
        )
        .await?;

    // Bind queue to exchange with the queue name as routing key
    bind_queue(&channel, queue_name, queue_name).await?;

    let consumer = channel
        .basic_consume(
            queue_name,
            "rtes_execution_consumer",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    info!("Started execution consumer on queue: {}", queue_name);

    let mut stream = Box::pin(consumer.take_until(cancel_token.cancelled()));

    while let Some(delivery) = stream.next().await {
        if let Ok(delivery) = delivery {
            match serde_json::from_slice::<NodeExecutionMessage>(&delivery.data) {
                Ok(msg) => {
                    if let Err(e) = state
                        .execution_store
                        .upsert_execution_definition(&msg)
                        .await
                    {
                        error!("Failed to upsert execution definition: {}", e);
                        let _ = delivery
                            .nack(BasicNackOptions {
                                requeue: false,
                                ..BasicNackOptions::default()
                            })
                            .await;
                    } else {
                        let _ = state.tx.send(WorkerMessage::NodeExecution(Box::new(msg)));
                        let _ = delivery.ack(BasicAckOptions::default()).await;
                    }
                },
                Err(e) => {
                    error!("Failed to deserialize execution message: {}", e);
                    let _ = delivery
                        .nack(BasicNackOptions { requeue: false, ..BasicNackOptions::default() })
                        .await;
                },
            }
        }
    }
    Ok(())
}

pub async fn start_status_consumer(
    amqp_addr: &str,
    state: AppState,
    cancel_token: CancellationToken,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::connect(amqp_addr, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    let cfg = crate::config::Config::get();
    let queue_name = &cfg.rabbitmq_status_queue;

    // Declare the workflows exchange
    declare_exchange(&channel).await?;

    let _queue = channel
        .queue_declare(
            queue_name,
            declare_options(cfg.rabbitmq_queue_durable),
            FieldTable::default(),
        )
        .await?;

    // Bind queue to exchange with the queue name as routing key
    bind_queue(&channel, queue_name, queue_name).await?;

    let consumer = channel
        .basic_consume(
            queue_name,
            "rtes_status_consumer",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    info!("Started status consumer on queue: {}", queue_name);

    let mut stream = Box::pin(consumer.take_until(cancel_token.cancelled()));

    while let Some(delivery) = stream.next().await {
        if let Ok(delivery) = delivery {
            match serde_json::from_slice::<NodeStatusMessage>(&delivery.data) {
                Ok(msg) => {
                    if let Err(e) = state.execution_store.update_node_status(&msg).await {
                        error!("Failed to update node status: {}", e);
                        let _ = delivery
                            .nack(BasicNackOptions {
                                requeue: false,
                                ..BasicNackOptions::default()
                            })
                            .await;
                    } else {
                        let _ = state.tx.send(WorkerMessage::NodeStatus(Box::new(msg)));
                        let _ = delivery.ack(BasicAckOptions::default()).await;
                    }
                },
                Err(e) => {
                    error!("Failed to deserialize status message: {}", e);
                    let _ = delivery
                        .nack(BasicNackOptions { requeue: false, ..BasicNackOptions::default() })
                        .await;
                },
            }
        }
    }
    Ok(())
}

pub async fn start_completion_consumer(
    amqp_addr: &str,
    state: AppState,
    cancel_token: CancellationToken,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::connect(amqp_addr, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    let cfg = crate::config::Config::get();
    let queue_name = &cfg.rabbitmq_completion_queue;

    // Declare the workflows exchange
    declare_exchange(&channel).await?;

    let _queue = channel
        .queue_declare(
            queue_name,
            declare_options(cfg.rabbitmq_queue_durable),
            FieldTable::default(),
        )
        .await?;

    // Bind queue to exchange with the queue name as routing key
    bind_queue(&channel, queue_name, queue_name).await?;

    let consumer = channel
        .basic_consume(
            queue_name,
            "rtes_completion_consumer",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    info!("Started completion consumer on queue: {}", queue_name);

    let mut stream = Box::pin(consumer.take_until(cancel_token.cancelled()));

    while let Some(delivery) = stream.next().await {
        if let Ok(delivery) = delivery {
            match serde_json::from_slice::<CompletionMessage>(&delivery.data) {
                Ok(msg) => {
                    if let Err(e) = state.execution_store.complete_execution(&msg).await {
                        error!("Failed to complete execution: {}", e);
                        let _ = delivery
                            .nack(BasicNackOptions {
                                requeue: false,
                                ..BasicNackOptions::default()
                            })
                            .await;
                    } else {
                        let _ = state
                            .tx
                            .send(WorkerMessage::WorkflowCompletion(Box::new(msg)));
                        let _ = delivery.ack(BasicAckOptions::default()).await;
                    }
                },
                Err(e) => {
                    error!("Failed to deserialize completion message: {}", e);
                    let _ = delivery
                        .nack(BasicNackOptions { requeue: false, ..BasicNackOptions::default() })
                        .await;
                },
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::expand_tokens_from_payload;

    #[test]
    fn expands_single_id_payload() {
        let payload = json!({
            "execution_id": "exec-1",
            "workflow_id": "wf-1",
            "iat": 1,
            "exp": 2,
            "user_id": "user-1"
        });
        let tokens = expand_tokens_from_payload(payload.to_string().as_bytes())
            .expect("single token payload should parse");
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].execution_id.as_deref(), Some("exec-1"));
        assert_eq!(tokens[0].workflow_id, "wf-1");
    }

    #[test]
    fn expands_multi_id_payload() {
        let payload = json!({
            "execution_ids": ["exec-1", "exec-2"],
            "workflow_ids": ["wf-1", "wf-2"],
            "iat": 1,
            "exp": 2,
            "user_id": "user-1"
        });
        let tokens = expand_tokens_from_payload(payload.to_string().as_bytes())
            .expect("multi-id token payload should parse");
        assert_eq!(tokens.len(), 4);
    }
}
