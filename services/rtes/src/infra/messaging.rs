use futures::StreamExt;
use lapin::{
    Connection,
    ConnectionProperties,
    options::{
        BasicAckOptions,
        BasicConsumeOptions,
        BasicNackOptions,
        BasicQosOptions,
        QueueDeclareOptions,
    },
    types::{AMQPValue, FieldTable},
};
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

use crate::{
    api::state::AppState,
    domain::models::{ExecutionResult, ExecutionStatus, ExecutionToken, WorkerMessage},
    infra::storage::TokenStore,
};

pub(crate) async fn start_token_consumer(
    amqp_addr: &str,
    token_store: TokenStore,
    cancel_token: CancellationToken,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::connect(amqp_addr, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    let cfg = crate::config::Config::get();
    let queue_name = &cfg.rabbitmq_queue_name;
    let consumer_tag = &cfg.rabbitmq_consumer_tag;
    let prefetch_count = cfg.rabbitmq_prefetch_count;
    let concurrent_messages = cfg.rabbitmq_concurrent_messages;

    channel
        .basic_qos(prefetch_count, BasicQosOptions::default())
        .await?;

    // Declare DLQ
    let dlq_name = format!("{}.dlq", queue_name);
    let _dlq = channel
        .queue_declare(
            &dlq_name,
            QueueDeclareOptions { durable: true, ..QueueDeclareOptions::default() },
            FieldTable::default(),
        )
        .await?;

    // Declare Main Queue with DLQ args
    let mut args = FieldTable::default();
    args.insert("x-dead-letter-exchange".into(), AMQPValue::LongString("".into()));
    args.insert("x-dead-letter-routing-key".into(), AMQPValue::LongString(dlq_name.into()));

    let _queue = channel
        .queue_declare(
            queue_name,
            QueueDeclareOptions { durable: true, ..QueueDeclareOptions::default() },
            args,
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
                    process_token_delivery(delivery, &token_store).await;
                }
            }
        })
        .await;

    Ok(())
}

async fn process_token_delivery(delivery: lapin::message::Delivery, token_store: &TokenStore) {
    match serde_json::from_slice::<ExecutionToken>(&delivery.data) {
        Ok(token) => {
            info!("Received token for user: {}", token.user_id);
            if let Err(e) = token_store.add_token(&token).await {
                error!("Failed to store token: {}", e);
                let _ = delivery
                    .nack(BasicNackOptions { requeue: false, ..BasicNackOptions::default() })
                    .await;
            } else {
                let _ = delivery.ack(BasicAckOptions::default()).await;
            }
        },
        Err(e) => {
            error!("Failed to deserialize token: {}", e);
            let _ = delivery
                .nack(BasicNackOptions { requeue: false, ..BasicNackOptions::default() })
                .await;
        },
    }
}

pub(crate) async fn start_status_consumer(
    amqp_addr: &str,
    state: AppState,
    cancel_token: CancellationToken,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::connect(amqp_addr, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    let cfg = crate::config::Config::get();
    let queue_name = &cfg.rabbitmq_status_queue;

    // Declare DLQ
    let dlq_name = format!("{}.dlq", queue_name);
    let _dlq = channel
        .queue_declare(
            &dlq_name,
            QueueDeclareOptions { durable: true, ..QueueDeclareOptions::default() },
            FieldTable::default(),
        )
        .await?;

    // Declare Main Queue with DLQ args
    let mut args = FieldTable::default();
    args.insert("x-dead-letter-exchange".into(), AMQPValue::LongString("".into()));
    args.insert("x-dead-letter-routing-key".into(), AMQPValue::LongString(dlq_name.into()));

    let _queue = channel
        .queue_declare(
            queue_name,
            QueueDeclareOptions { durable: true, ..QueueDeclareOptions::default() },
            args,
        )
        .await?;

    let mut consumer = channel
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
            match serde_json::from_slice::<ExecutionStatus>(&delivery.data) {
                Ok(status) => {
                    if let Err(e) = state.execution_store.save_status(&status).await {
                        error!("Failed to save status: {}", e);
                        let _ = delivery
                            .nack(BasicNackOptions {
                                requeue: false,
                                ..BasicNackOptions::default()
                            })
                            .await;
                    } else {
                        let _ = state.tx.send(WorkerMessage::Status(status));
                        let _ = delivery.ack(BasicAckOptions::default()).await;
                    }
                },
                Err(e) => {
                    error!("Failed to deserialize status: {}", e);
                    let _ = delivery
                        .nack(BasicNackOptions { requeue: false, ..BasicNackOptions::default() })
                        .await;
                },
            }
        }
    }
    Ok(())
}

pub(crate) async fn start_completion_consumer(
    amqp_addr: &str,
    state: AppState,
    cancel_token: CancellationToken,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::connect(amqp_addr, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    let cfg = crate::config::Config::get();
    let queue_name = &cfg.rabbitmq_completion_queue;

    // Declare DLQ
    let dlq_name = format!("{}.dlq", queue_name);
    let _dlq = channel
        .queue_declare(
            &dlq_name,
            QueueDeclareOptions { durable: true, ..QueueDeclareOptions::default() },
            FieldTable::default(),
        )
        .await?;

    // Declare Main Queue with DLQ args
    let mut args = FieldTable::default();
    args.insert("x-dead-letter-exchange".into(), AMQPValue::LongString("".into()));
    args.insert("x-dead-letter-routing-key".into(), AMQPValue::LongString(dlq_name.into()));

    let _queue = channel
        .queue_declare(
            queue_name,
            QueueDeclareOptions { durable: true, ..QueueDeclareOptions::default() },
            args,
        )
        .await?;

    let mut consumer = channel
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
            match serde_json::from_slice::<ExecutionResult>(&delivery.data) {
                Ok(result) => {
                    if let Err(e) = state.execution_store.save_result(&result).await {
                        error!("Failed to save result: {}", e);
                        let _ = delivery
                            .nack(BasicNackOptions {
                                requeue: false,
                                ..BasicNackOptions::default()
                            })
                            .await;
                    } else {
                        let _ = state.tx.send(WorkerMessage::Result(result));
                        let _ = delivery.ack(BasicAckOptions::default()).await;
                    }
                },
                Err(e) => {
                    error!("Failed to deserialize result: {}", e);
                    let _ = delivery
                        .nack(BasicNackOptions { requeue: false, ..BasicNackOptions::default() })
                        .await;
                },
            }
        }
    }
    Ok(())
}
