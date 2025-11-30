"""
Rune CLI - Config Commands

Commands for viewing and managing configuration.
"""

import click
from pathlib import Path

from ..styles import (
    print_header,
    print_success,
    print_error,
    print_warning,
    print_info,
    print_divider,
    print_config_value,
    confirm_action,
    RUNE_PRIMARY,
)


@click.group()
def config():
    """
    Configuration management commands.

    \b
    View and manage Rune configuration settings.
    """
    pass


@config.command("show")
@click.option(
    "--reveal-secrets", is_flag=True, help="Show secret values (use with caution)"
)
def show_config(reveal_secrets: bool):
    """
    Display current configuration.

    \b
    Examples:
        rune config show
        rune config show --reveal-secrets
    """
    print_header("Rune Configuration")

    from src.core.config import get_settings

    settings = get_settings()

    # Application Settings
    click.echo(click.style("\n📦 Application", fg=RUNE_PRIMARY, bold=True))
    print_config_value("Environment", settings.environment.value)
    print_config_value("App Name", settings.app_name)
    print_config_value("CORS Origins", settings.cors_origins)

    # Database Settings
    click.echo(click.style("\n🗄️  Database", fg=RUNE_PRIMARY, bold=True))
    print_config_value("Host", settings.postgres_host)
    print_config_value("Port", str(settings.postgres_port))
    print_config_value("Database", settings.postgres_db)
    print_config_value("User", settings.postgres_user)
    print_config_value(
        "Password", settings.postgres_password, masked=not reveal_secrets
    )

    # JWT Settings
    click.echo(click.style("\n🔐 JWT", fg=RUNE_PRIMARY, bold=True))
    print_config_value("Algorithm", settings.jwt_algorithm)
    print_config_value(
        "Access Token Expiry", f"{settings.access_token_expire_minutes} minutes"
    )
    print_config_value(
        "Refresh Token Expiry", f"{settings.refresh_token_expire_days} days"
    )
    print_config_value(
        "Secret Key",
        settings.jwt_secret_key or "NOT SET",
        masked=not reveal_secrets and bool(settings.jwt_secret_key),
    )

    # Redis Settings
    click.echo(click.style("\n📮 Redis", fg=RUNE_PRIMARY, bold=True))
    print_config_value("Host", settings.redis_host)
    print_config_value("Port", str(settings.redis_port))
    print_config_value("Database", str(settings.redis_db))
    print_config_value(
        "Password",
        settings.redis_password or "None",
        masked=not reveal_secrets and bool(settings.redis_password),
    )

    # RabbitMQ Settings
    click.echo(click.style("\n🐰 RabbitMQ", fg=RUNE_PRIMARY, bold=True))
    print_config_value("Host", settings.rabbitmq_host)
    print_config_value("Port", str(settings.rabbitmq_port))
    print_config_value("Username", settings.rabbitmq_username)
    print_config_value(
        "Password", settings.rabbitmq_password, masked=not reveal_secrets
    )
    print_config_value("Queue Name", settings.rabbitmq_queue_name)

    # Security
    click.echo(click.style("\n🔒 Security", fg=RUNE_PRIMARY, bold=True))
    print_config_value("Cookie Secure", str(settings.cookie_secure))
    print_config_value(
        "Encryption Key",
        settings.encryption_key or "NOT SET",
        masked=not reveal_secrets and bool(settings.encryption_key),
    )

    print_divider()


@config.command("check")
def check_config():
    """
    Validate configuration and check for issues.

    \b
    Examples:
        rune config check
    """
    print_header("Configuration Check")

    from src.core.config import get_settings

    settings = get_settings()
    issues = []
    warnings = []

    # Check critical settings
    if not settings.jwt_secret_key:
        issues.append("JWT_SECRET_KEY is not set - authentication will fail")
    elif len(settings.jwt_secret_key) < 32:
        warnings.append("JWT_SECRET_KEY is short - consider using a longer key")

    if not settings.encryption_key:
        warnings.append("ENCRYPTION_KEY is not set - credential encryption may fail")

    if settings.environment.value == "prod":
        if not settings.cookie_secure:
            warnings.append("Cookie secure is disabled in production")
        if "localhost" in settings.cors_origins:
            warnings.append("localhost is in CORS origins in production")

    if settings.postgres_password == "postgres":
        warnings.append("Using default PostgreSQL password")

    if settings.rabbitmq_password == "guest":
        warnings.append("Using default RabbitMQ password")

    # Display results
    if issues:
        click.echo(click.style("\n❌ Critical Issues:", fg="red", bold=True))
        for issue in issues:
            print_error(issue)

    if warnings:
        click.echo(click.style("\n⚠️  Warnings:", fg="yellow", bold=True))
        for warning in warnings:
            print_warning(warning)

    if not issues and not warnings:
        print_success("All configuration checks passed!")
    elif not issues:
        print_info("Configuration is valid with some warnings")
    else:
        print_error("Configuration has critical issues that must be resolved")

    print_divider()


@config.command("generate-key")
@click.option(
    "--type",
    "key_type",
    type=click.Choice(["jwt", "encryption", "both"]),
    default="both",
    help="Type of key to generate",
)
@click.option("--length", default=64, help="Key length in bytes")
def generate_key(key_type: str, length: int):
    """
    Generate secure random keys.

    \b
    Examples:
        rune config generate-key
        rune config generate-key --type jwt
        rune config generate-key --length 32
    """
    print_header("Generate Security Keys")

    import secrets

    if key_type in ("jwt", "both"):
        jwt_key = secrets.token_urlsafe(length)
        click.echo(click.style("\n🔑 JWT Secret Key:", fg=RUNE_PRIMARY, bold=True))
        click.echo(f"JWT_SECRET_KEY={jwt_key}")

    if key_type in ("encryption", "both"):
        # Fernet requires 32 bytes base64 encoded
        from cryptography.fernet import Fernet

        encryption_key = Fernet.generate_key().decode()
        click.echo(click.style("\n🔐 Encryption Key:", fg=RUNE_PRIMARY, bold=True))
        click.echo(f"ENCRYPTION_KEY={encryption_key}")

    print_divider()
    print_info("Add these to your .env file")


@config.command("init")
@click.option("--force", "-f", is_flag=True, help="Overwrite existing .env file")
@click.option("--interactive", "-i", is_flag=True, help="Interactive mode with prompts")
def init_config(force: bool, interactive: bool):
    """
    Initialize a new .env configuration file.

    \b
    Examples:
        rune config init
        rune config init --interactive
        rune config init --force
    """
    print_header("Initialize Configuration")

    import secrets
    from cryptography.fernet import Fernet

    # Determine .env location
    env_path = Path.cwd() / ".env"

    if env_path.exists() and not force:
        print_warning(f".env file already exists at {env_path}")
        if not confirm_action("Do you want to overwrite it?"):
            print_info("Operation cancelled")
            return

    # Generate secure keys
    jwt_key = secrets.token_urlsafe(64)
    encryption_key = Fernet.generate_key().decode()

    # Default configuration
    config_values = {
        "ENVIRONMENT": "dev",
        "APP_NAME": "Rune API",
        "CORS_ORIGINS": "http://localhost:3000,http://127.0.0.1:3000",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "postgres",
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "rune",
        "JWT_SECRET_KEY": jwt_key,
        "JWT_ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": "30",
        "REFRESH_TOKEN_EXPIRE_DAYS": "30",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379",
        "REDIS_DB": "0",
        "RABBITMQ_HOST": "localhost",
        "RABBITMQ_PORT": "5672",
        "RABBITMQ_USERNAME": "guest",
        "RABBITMQ_PASSWORD": "guest",
        "RABBITMQ_QUEUE_NAME": "workflow_runs",
        "ENCRYPTION_KEY": encryption_key,
    }

    if interactive:
        click.echo(
            click.style("\n📝 Interactive Configuration\n", fg=RUNE_PRIMARY, bold=True)
        )
        print_info("Press Enter to accept default values")
        print_divider()

        config_values["ENVIRONMENT"] = click.prompt(
            "Environment",
            default=config_values["ENVIRONMENT"],
            type=click.Choice(["dev", "prod"]),
        )
        config_values["APP_NAME"] = click.prompt(
            "App Name", default=config_values["APP_NAME"]
        )
        config_values["POSTGRES_HOST"] = click.prompt(
            "PostgreSQL Host", default=config_values["POSTGRES_HOST"]
        )
        config_values["POSTGRES_PORT"] = click.prompt(
            "PostgreSQL Port", default=config_values["POSTGRES_PORT"]
        )
        config_values["POSTGRES_DB"] = click.prompt(
            "PostgreSQL Database", default=config_values["POSTGRES_DB"]
        )
        config_values["POSTGRES_USER"] = click.prompt(
            "PostgreSQL User", default=config_values["POSTGRES_USER"]
        )
        config_values["POSTGRES_PASSWORD"] = click.prompt(
            "PostgreSQL Password",
            default=config_values["POSTGRES_PASSWORD"],
            hide_input=True,
        )
        config_values["REDIS_HOST"] = click.prompt(
            "Redis Host", default=config_values["REDIS_HOST"]
        )
        config_values["RABBITMQ_HOST"] = click.prompt(
            "RabbitMQ Host", default=config_values["RABBITMQ_HOST"]
        )

    # Generate .env content
    env_content = """# ═══════════════════════════════════════════════════════════════
# Rune Configuration
# Generated by: rune config init
# ═══════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────
# Application Settings
# ─────────────────────────────────────────────────────────────────
ENVIRONMENT={ENVIRONMENT}
APP_NAME={APP_NAME}
CORS_ORIGINS={CORS_ORIGINS}

# ─────────────────────────────────────────────────────────────────
# Database Settings
# ─────────────────────────────────────────────────────────────────
POSTGRES_USER={POSTGRES_USER}
POSTGRES_PASSWORD={POSTGRES_PASSWORD}
POSTGRES_HOST={POSTGRES_HOST}
POSTGRES_PORT={POSTGRES_PORT}
POSTGRES_DB={POSTGRES_DB}

# ─────────────────────────────────────────────────────────────────
# JWT Settings
# ─────────────────────────────────────────────────────────────────
JWT_SECRET_KEY={JWT_SECRET_KEY}
JWT_ALGORITHM={JWT_ALGORITHM}
ACCESS_TOKEN_EXPIRE_MINUTES={ACCESS_TOKEN_EXPIRE_MINUTES}
REFRESH_TOKEN_EXPIRE_DAYS={REFRESH_TOKEN_EXPIRE_DAYS}

# ─────────────────────────────────────────────────────────────────
# Redis Settings
# ─────────────────────────────────────────────────────────────────
REDIS_HOST={REDIS_HOST}
REDIS_PORT={REDIS_PORT}
REDIS_DB={REDIS_DB}

# ─────────────────────────────────────────────────────────────────
# RabbitMQ Settings
# ─────────────────────────────────────────────────────────────────
RABBITMQ_HOST={RABBITMQ_HOST}
RABBITMQ_PORT={RABBITMQ_PORT}
RABBITMQ_USERNAME={RABBITMQ_USERNAME}
RABBITMQ_PASSWORD={RABBITMQ_PASSWORD}
RABBITMQ_QUEUE_NAME={RABBITMQ_QUEUE_NAME}

# ─────────────────────────────────────────────────────────────────
# Security Settings
# ─────────────────────────────────────────────────────────────────
ENCRYPTION_KEY={ENCRYPTION_KEY}
""".format(**config_values)

    env_path.write_text(env_content)

    print_success(f"Configuration file created: {env_path}")
    print_divider()
    print_info("Review and update the values as needed")
    print_warning("Keep this file secure and never commit it to version control!")


@config.command("env")
@click.argument("key", required=False)
@click.option("--set", "value", help="Set the value for the key")
def env_var(key: str, value: str):
    """
    Get or set environment variables.

    \b
    Examples:
        rune config env                    # List all
        rune config env POSTGRES_HOST      # Get specific
        rune config env POSTGRES_HOST --set localhost  # Set value
    """
    env_path = Path.cwd() / ".env"

    if not env_path.exists():
        print_error(".env file not found")
        print_info("Run 'rune config init' to create one")
        return

    if not key:
        # List all environment variables
        print_header("Environment Variables")
        content = env_path.read_text()
        for line in content.split("\n"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                masked = any(
                    secret in k.upper() for secret in ["PASSWORD", "SECRET", "KEY"]
                )
                print_config_value(k, v, masked=masked)
        return

    if value:
        # Set value
        content = env_path.read_text()
        lines = content.split("\n")
        found = False

        for i, line in enumerate(lines):
            if line.strip().startswith(f"{key}="):
                lines[i] = f"{key}={value}"
                found = True
                break

        if not found:
            lines.append(f"{key}={value}")

        env_path.write_text("\n".join(lines))
        print_success(f"Set {key}={value}")
    else:
        # Get value
        content = env_path.read_text()
        for line in content.split("\n"):
            if line.strip().startswith(f"{key}="):
                _, v = line.split("=", 1)
                click.echo(v)
                return
        print_error(f"Key '{key}' not found")
