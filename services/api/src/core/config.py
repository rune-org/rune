from enum import Enum
from functools import lru_cache
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    """Application environment types."""

    DEV = "dev"
    PROD = "prod"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Application Settings
    environment: Environment = Environment.DEV
    app_name: str = "Rune API"

    # Database Settings
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "rune"
    database_url: str | None = None

    # JWT Settings
    jwt_secret_key: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 2
    refresh_token_expire_days: int = 30

    # Redis Settings
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str | None = None

    # RabbitMQ Settings
    rabbitmq_queue_name: str = "workflow_runs"
    rabbitmq_host: str = "localhost"
    rabbitmq_port: int = 5672
    rabbitmq_username: str = "guest"
    rabbitmq_password: str = "guest"
    rabbitmq_url: str | None = None

    # Encryption Settings
    encryption_key: str | None = None

    @computed_field
    @property
    def cookie_secure(self) -> bool:
        """Cookie secure flag - only true in production."""
        return self.environment == Environment.PROD


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance.

    This function uses lru_cache to ensure only one Settings
    instance is created and reused throughout the application.
    """
    return Settings()
