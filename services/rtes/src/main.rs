#![allow(clippy::cargo_common_metadata)]

//! RTES - Rune Token Execution Service
//!
//! This service handles execution tokens and real-time events.

mod api;
mod config;
mod domain;
mod infra;

use tokio_util::sync::CancellationToken;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    config::Config::init()?;
    let cfg = config::Config::get();

    // let tracer_provider = infra::telemetry::init_telemetry("rtes", &cfg.otel_endpoint)?;

    info!("Starting RTES service...");

    let client = redis::Client::open(cfg.redis_url.as_str())?;
    let token_store = infra::token_store::TokenStore::new(client);

    let execution_store =
        infra::execution_store::ExecutionStore::new(&cfg.mongodb_url, "rtes_db").await?;

    let state = api::state::AppState::new(token_store.clone(), execution_store);

    let cancel_token = CancellationToken::new();
    let cancel_token_clone = cancel_token.clone();

    tokio::spawn(async move {
        if matches!(tokio::signal::ctrl_c().await, Ok(())) {
            info!("Shutdown signal received");
            cancel_token_clone.cancel();
        }
    });

    spawn_consumers(&cfg.amqp_url, &state, &cancel_token);

    start_server(state, cancel_token).await?;

    // let _ = tracer_provider.shutdown();
    info!("RTES service stopped");

    Ok(())
}

fn spawn_consumers(amqp_url: &str, state: &api::state::AppState, cancel_token: &CancellationToken) {
    let url = amqp_url.to_string();
    let token_store = state.token_store.clone();
    let ct = cancel_token.clone();
    tokio::spawn(async move {
        info!("Connecting to RabbitMQ for Token Consumer at {}", url);
        if let Err(e) = infra::messaging::start_token_consumer(&url, token_store, ct).await {
            tracing::error!("Token Consumer error: {}", e);
        }
    });

    let url = amqp_url.to_string();
    let s = state.clone();
    let ct = cancel_token.clone();
    tokio::spawn(async move {
        info!("Connecting to RabbitMQ for Execution Consumer at {}", url);
        if let Err(e) = infra::messaging::start_execution_consumer(&url, s, ct).await {
            tracing::error!("Execution Consumer error: {}", e);
        }
    });

    let url = amqp_url.to_string();
    let s = state.clone();
    let ct = cancel_token.clone();
    tokio::spawn(async move {
        info!("Connecting to RabbitMQ for Status Consumer at {}", url);
        if let Err(e) = infra::messaging::start_status_consumer(&url, s, ct).await {
            tracing::error!("Status Consumer error: {}", e);
        }
    });

    let url = amqp_url.to_string();
    let s = state.clone();
    let ct = cancel_token.clone();
    tokio::spawn(async move {
        info!("Connecting to RabbitMQ for Completion Consumer at {}", url);
        if let Err(e) = infra::messaging::start_completion_consumer(&url, s, ct).await {
            tracing::error!("Completion Consumer error: {}", e);
        }
    });
}

async fn start_server(
    state: api::state::AppState,
    cancel_token: CancellationToken,
) -> Result<(), Box<dyn std::error::Error>> {
    let cfg = config::Config::get();
    let app = api::routes::app(state);
    let addr = format!("0.0.0.0:{}", cfg.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Listening on {}", listener.local_addr()?);
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            cancel_token.cancelled().await;
            info!("Server shutting down");
        })
        .await?;
    Ok(())
}
