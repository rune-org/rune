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
    cors_origins_raw: str = (
        "http://localhost:3000,http://frontend:3000,http://127.0.0.1:3000"
    )

    # Database Settings
    postgres_user: str = "rune"
    postgres_password: str = "rune_password"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "rune_db"
    database_url: str | None = None

    # JWT Settings
    jwt_secret_key: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 2
    refresh_token_expire_days: int = 30

    # Cookie Settings
    cookie_name: str = "access_token"

    # Redis Settings
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str | None = None

    # RabbitMQ Settings
    rabbitmq_workflow_queue: str = "workflow.execution"
    rabbitmq_token_queue: str = "execution.token"
    rabbitmq_host: str = "localhost"
    rabbitmq_port: int = 5672
    rabbitmq_username: str = "guest"
    rabbitmq_password: str = "guest"
    rabbitmq_url: str | None = None

    # Encryption Settings
    encryption_key: str | None = None

    # Smith AI Agent Settings
    smith_model: str = "gemini-2.0-flash"
    smith_temperature: float = 0.3
    google_api_key: str | None = None

    # Scryb Documentation Settings
    scryb_model: str = "gemini/gemini-2.5-flash-lite"

    # SAML SSO Settings
    # The public-facing base URL of the API (used to build ACS / metadata URLs).
    # Must NOT end with a trailing slash.
    # Default matches the nginx-proxied local dev URL (https://localhost/api).
    # Override via SAML_SP_BASE_URL in .env for staging/production.
    saml_sp_base_url: str = "https://localhost/api"
    # The public-facing base URL of the frontend (used to build post-SSO redirect URLs).
    # Override via SAML_FRONTEND_URL in .env for staging/production.
    saml_frontend_url: str = "https://localhost"
    # How long (seconds) to remember a processed SAML assertion ID (replay protection).
    saml_assertion_id_ttl: int = 300

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        """Parse CORS origins from a comma-separated string or JSON-style list string."""
        v = self.cors_origins_raw
        if not isinstance(v, str):
            raise ValueError(f"cors_origins_raw must be a string, got {type(v)}")
        if v.startswith("["):
            v = v.strip("[]")
        origins = [i.strip() for i in v.split(",") if i.strip()]
        if not origins:
            raise ValueError("CORS_ORIGINS must contain at least one origin")
        return origins

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
