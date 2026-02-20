use std::{env, sync::OnceLock};

pub static CONFIG: OnceLock<Config> = OnceLock::new();

#[derive(Debug)]
pub struct Config {
    pub redis_url: String,
    pub amqp_url: String,
    pub otel_endpoint: String,
    pub rabbitmq_token_queue: String,
    pub rabbitmq_consumer_tag: String,
    pub rabbitmq_prefetch_count: u16,
    pub rabbitmq_concurrent_messages: usize,
    pub rabbitmq_queue_durable: bool,
    pub mongodb_url: String,
    pub rabbitmq_status_queue: String,
    pub rabbitmq_completion_queue: String,
    pub rabbitmq_execution_queue: String,
    pub port: u16,
    pub jwt_secret: String,
    /// CORS allowed origin for HTTP endpoints (required for credentials)
    pub cors_origin: String,
}

impl Config {
    fn parse_bool_env(name: &str, default: bool) -> bool {
        env::var(name).map_or(default, |v| {
            matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "y" | "on")
        })
    }

    pub fn init() -> Result<(), Box<dyn std::error::Error>> {
        let config = Self {
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string()),
            amqp_url: env::var("AMQP_URL")
                .unwrap_or_else(|_| "amqp://127.0.0.1:5672/%2f".to_string()),
            otel_endpoint: env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
                .unwrap_or_else(|_| "http://localhost:4318".to_string()),
            rabbitmq_token_queue: env::var("RABBITMQ_TOKEN_QUEUE")
                .unwrap_or_else(|_| "execution.token".to_string()),
            rabbitmq_consumer_tag: env::var("RABBITMQ_CONSUMER_TAG")
                .unwrap_or_else(|_| "rtes_token_consumer".to_string()),
            rabbitmq_prefetch_count: env::var("RABBITMQ_PREFETCH_COUNT")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10),
            rabbitmq_concurrent_messages: env::var("RABBITMQ_CONCURRENT_MESSAGES")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10),
            rabbitmq_queue_durable: Self::parse_bool_env("RABBITMQ_QUEUE_DURABLE", false),
            mongodb_url: env::var("MONGODB_URL")
                .unwrap_or_else(|_| "mongodb://localhost:27017".to_string()),
            rabbitmq_status_queue: env::var("RABBITMQ_STATUS_QUEUE")
                .unwrap_or_else(|_| "workflow.node.status".to_string()),
            rabbitmq_completion_queue: env::var("RABBITMQ_COMPLETION_QUEUE")
                .unwrap_or_else(|_| "workflow.completion".to_string()),
            rabbitmq_execution_queue: env::var("RABBITMQ_EXECUTION_QUEUE")
                .unwrap_or_else(|_| "workflow.worker.initiated".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .unwrap_or(3000),
            jwt_secret: env::var("JWT_SECRET_KEY").unwrap_or_else(|_| "secret".to_string()),
            cors_origin: env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
        };

        CONFIG
            .set(config)
            .map_err(|_| "Config already initialized")?;
        Ok(())
    }

    #[allow(clippy::expect_used)]
    pub fn get() -> &'static Self {
        CONFIG.get().expect("Config not initialized")
    }
}
