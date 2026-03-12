from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Database
    postgres_user: str = "rune"
    postgres_password: str = "rune_password"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "rune_db"
    database_url: str | None = None

    # RabbitMQ
    rabbitmq_host: str = "rabbitmq"
    rabbitmq_port: int = 5672
    rabbitmq_username: str = "rune"
    rabbitmq_password: str = "rune_password"
    rabbitmq_url: str | None = None
    rabbitmq_exchange: str = "workflows"
    rabbitmq_queue: str = "workflow.completion.recorder"
    rabbitmq_routing_key: str = "workflow.completion"
    rabbitmq_prefetch: int = 10

    @computed_field
    @property
    def db_url(self) -> str:
        if self.database_url:
            url = self.database_url
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @computed_field
    @property
    def amqp_url(self) -> str:
        if self.rabbitmq_url:
            return self.rabbitmq_url
        return (
            f"amqp://{self.rabbitmq_username}:{self.rabbitmq_password}"
            f"@{self.rabbitmq_host}:{self.rabbitmq_port}/"
        )
