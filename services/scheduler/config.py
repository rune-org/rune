"""Configuration management for scheduler service."""

import os


class Config:
    """Configuration loaded from environment variables."""

    # Database Configuration
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "db")
    POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_DB = os.getenv("POSTGRES_DB", "rune")
    POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")

    # RabbitMQ Configuration
    RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
    RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
    RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
    RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")
    RABBITMQ_QUEUE = os.getenv("RABBITMQ_QUEUE", "workflow_queue")

    # Scheduler Configuration
    POLL_INTERVAL = int(os.getenv("SCHEDULER_POLL_INTERVAL", "30"))
    LOOK_AHEAD_SECONDS = int(os.getenv("SCHEDULER_LOOK_AHEAD", "60"))
    HEALTHCHECK_INTERVAL = int(os.getenv("SCHEDULER_HEALTHCHECK_INTERVAL", "60"))

    # Encryption Configuration
    ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")

    # Database Pool Configuration
    DB_POOL_MIN_SIZE = int(os.getenv("DB_POOL_MIN_SIZE", "1"))
    DB_POOL_MAX_SIZE = int(os.getenv("DB_POOL_MAX_SIZE", "10"))

    # Logging Configuration
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    @classmethod
    def database_dsn(cls) -> str:
        """Build PostgreSQL DSN."""
        return (
            f"postgresql://{cls.POSTGRES_USER}:{cls.POSTGRES_PASSWORD}@"
            f"{cls.POSTGRES_HOST}:{cls.POSTGRES_PORT}/{cls.POSTGRES_DB}"
        )

    @classmethod
    def rabbitmq_url(cls) -> str:
        """Build RabbitMQ connection URL."""
        return (
            f"amqp://{cls.RABBITMQ_USER}:{cls.RABBITMQ_PASSWORD}@"
            f"{cls.RABBITMQ_HOST}:{cls.RABBITMQ_PORT}/"
        )
