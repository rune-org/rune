use crate::domain::models::ExecutionToken;
use crate::infra::storage::TokenStore;
use futures::StreamExt;
use lapin::{options::{BasicAckOptions, BasicConsumeOptions, QueueDeclareOptions}, types::FieldTable, Connection, ConnectionProperties};
use tracing::{error, info};

pub(crate) async fn start_consumer(
    amqp_addr: &str,
    token_store: TokenStore,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::connect(amqp_addr, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    let queue_name = "execution.token";

    let _queue = channel
        .queue_declare(
            queue_name,
            QueueDeclareOptions::default(),
            FieldTable::default(),
        )
        .await?;

    let mut consumer = channel
        .basic_consume(
            queue_name,
            "rtes_token_consumer",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    info!("Started consumer on queue: {}", queue_name);

    while let Some(delivery) = consumer.next().await {
        if let Ok(delivery) = delivery {
            process_delivery(delivery, &token_store).await;
        }
    }

    Ok(())
}

async fn process_delivery(delivery: lapin::message::Delivery, token_store: &TokenStore) {
    match serde_json::from_slice::<ExecutionToken>(&delivery.data) {
        Ok(token) => {
            info!("Received token for user: {}", token.user_id);
            if let Err(e) = token_store.add_token(&token).await {
                error!("Failed to store token: {}", e);
            } else {
                let _ = delivery.ack(BasicAckOptions::default()).await;
            }
        }
        Err(e) => {
            error!("Failed to deserialize token: {}", e);
            let _ = delivery.ack(BasicAckOptions::default()).await;
        }
    }
}
