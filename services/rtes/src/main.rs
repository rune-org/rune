mod api;
mod domain;
mod infra;

use std::env;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let (redis_url, amqp_url, otel_endpoint) = load_config();

    infra::telemetry::init_telemetry("rtes", &otel_endpoint)?;

    info!("Starting RTES service...");

    let client = redis::Client::open(redis_url)?;
    let token_store = infra::storage::TokenStore::new(client);

    spawn_consumer(amqp_url, token_store.clone());

    start_server().await?;

    Ok(())
}

fn load_config() -> (String, String, String) {
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
    let amqp_url = env::var("AMQP_URL").unwrap_or_else(|_| "amqp://127.0.0.1:5672/%2f".to_string());
    let otel_endpoint = env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
        .unwrap_or_else(|_| "http://localhost:4317".to_string());
    (redis_url, amqp_url, otel_endpoint)
}

fn spawn_consumer(amqp_url: String, token_store: infra::storage::TokenStore) {
    tokio::spawn(async move {
        info!("Connecting to RabbitMQ at {}", amqp_url);
        if let Err(e) = infra::messaging::start_consumer(&amqp_url, token_store).await {
            tracing::error!("Consumer error: {}", e);
        }
    });
}

async fn start_server() -> Result<(), Box<dyn std::error::Error>> {
    let app = api::routes::app();
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    info!("Listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;
    Ok(())
}
