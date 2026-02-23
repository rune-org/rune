#![allow(clippy::cargo_common_metadata)]

//! RTES - Real Time Execution Service
//!
//! This service handles execution tokens and real-time events.

use std::future::Future;

use rtes::{api, config, infra};
use tokio_util::sync::CancellationToken;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    config::Config::init()?;
    let cfg = config::Config::get();

    let tracer_provider = infra::telemetry::init_telemetry("rtes", &cfg.otel_endpoint)?;

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

    // Start RabbitMQ consumers (each consumer handles its own exchange/queue setup)
    spawn_consumers(&cfg.amqp_url, &state, &cancel_token);

    start_server(state, cancel_token).await?;

    let _ = tracer_provider.shutdown();
    info!("RTES service stopped");

    Ok(())
}

const RABBITMQ_RETRY_DELAY: std::time::Duration = std::time::Duration::from_secs(5);

async fn run_consumer_with_retry<F, Fut>(
    name: &'static str,
    amqp_url: String,
    cancel_token: CancellationToken,
    start: F,
) where
    F: Fn(String, CancellationToken) -> Fut + Send + Sync + 'static,
    Fut: Future<Output = Result<(), String>> + Send + 'static,
{
    let mut attempt: u64 = 0;
    loop {
        if cancel_token.is_cancelled() {
            return;
        }
        attempt += 1;
        info!("Connecting to RabbitMQ for {} at {} (attempt {})", name, amqp_url, attempt);
        match start(amqp_url.clone(), cancel_token.clone()).await {
            Ok(()) => return,
            Err(e) => {
                tracing::error!("{} error: {} - retrying in {:?}", name, e, RABBITMQ_RETRY_DELAY);
                if cancel_token.is_cancelled() {
                    return;
                }
                tokio::time::sleep(RABBITMQ_RETRY_DELAY).await;
            },
        }
    }
}

fn spawn_consumers(amqp_url: &str, state: &api::state::AppState, cancel_token: &CancellationToken) {
    let url = amqp_url.to_string();
    let token_store = state.token_store.clone();
    let ct = cancel_token.clone();
    tokio::spawn(async move {
        run_consumer_with_retry("Token Consumer", url, ct, move |amqp_url, ct| {
            let token_store = token_store.clone();
            async move {
                infra::messaging::start_token_consumer(&amqp_url, token_store, ct)
                    .await
                    .map_err(|e| e.to_string())
            }
        })
        .await;
    });

    let url = amqp_url.to_string();
    let s = state.clone();
    let ct = cancel_token.clone();
    tokio::spawn(async move {
        run_consumer_with_retry("Execution Consumer", url, ct, move |amqp_url, ct| {
            let s = s.clone();
            async move {
                infra::messaging::start_execution_consumer(&amqp_url, s, ct)
                    .await
                    .map_err(|e| e.to_string())
            }
        })
        .await;
    });

    let url = amqp_url.to_string();
    let s = state.clone();
    let ct = cancel_token.clone();
    tokio::spawn(async move {
        run_consumer_with_retry("Status Consumer", url, ct, move |amqp_url, ct| {
            let s = s.clone();
            async move {
                infra::messaging::start_status_consumer(&amqp_url, s, ct)
                    .await
                    .map_err(|e| e.to_string())
            }
        })
        .await;
    });

    let url = amqp_url.to_string();
    let s = state.clone();
    let ct = cancel_token.clone();
    tokio::spawn(async move {
        run_consumer_with_retry("Completion Consumer", url, ct, move |amqp_url, ct| {
            let s = s.clone();
            async move {
                infra::messaging::start_completion_consumer(&amqp_url, s, ct)
                    .await
                    .map_err(|e| e.to_string())
            }
        })
        .await;
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
