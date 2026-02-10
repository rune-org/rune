"""
Configuration Management

Handles CLI configuration storage, retrieval, and validation.
Supports file-based config, environment variables, and defaults.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class RuneConfig:
    """Configuration data class with all settings."""
    
    # API Settings
    api_url: str = "http://localhost:8000"
    timeout: int = 30
    verify_ssl: bool = True
    
    # Database Settings (for direct access)
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "rune_db"
    db_user: str = "rune"
    db_password: str = "rune_password"
    
    # Docker Settings
    docker_container: str = "rune-postgres"
    docker_compose_path: str = ""
    
    # Output Settings
    default_output_format: str = "text"
    color_enabled: bool = True
    verbose: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RuneConfig":
        """Create from dictionary, ignoring unknown keys."""
        valid_keys = {f.name for f in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in valid_keys}
        return cls(**filtered_data)


def get_config_dir() -> Path:
    """Get the configuration directory path."""
    return Path.home() / ".rune"


def get_config_path() -> Path:
    """Get the path to the configuration file."""
    return get_config_dir() / "config.json"


def get_credentials_path() -> Path:
    """Get the path to the credentials file."""
    return get_config_dir() / "credentials.json"


def ensure_config_dir() -> Path:
    """Ensure the configuration directory exists."""
    config_dir = get_config_dir()
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir


def load_config_file() -> Dict[str, Any]:
    """Load configuration from file."""
    config_path = get_config_path()
    if config_path.exists():
        try:
            return json.loads(config_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            pass
    return {}


def load_env_config() -> Dict[str, Any]:
    """Load configuration from environment variables."""
    env_mapping = {
        "RUNE_API_URL": ("api_url", str),
        "RUNE_TIMEOUT": ("timeout", int),
        "RUNE_VERIFY_SSL": ("verify_ssl", lambda x: x.lower() in ("true", "1", "yes")),
        "RUNE_DB_HOST": ("db_host", str),
        "RUNE_DB_PORT": ("db_port", int),
        "RUNE_DB_NAME": ("db_name", str),
        "RUNE_DB_USER": ("db_user", str),
        "RUNE_DB_PASSWORD": ("db_password", str),
        "RUNE_DOCKER_CONTAINER": ("docker_container", str),
        "RUNE_OUTPUT_FORMAT": ("default_output_format", str),
        "RUNE_COLOR": ("color_enabled", lambda x: x.lower() in ("true", "1", "yes")),
        "RUNE_VERBOSE": ("verbose", lambda x: x.lower() in ("true", "1", "yes")),
    }
    
    config = {}
    for env_var, (key, converter) in env_mapping.items():
        value = os.getenv(env_var)
        if value is not None:
            try:
                config[key] = converter(value)
            except (ValueError, TypeError):
                pass
    
    return config


def get_config() -> RuneConfig:
    """
    Load complete configuration with priority:
    1. Environment variables (highest)
    2. Config file
    3. Defaults (lowest)
    """
    # Start with defaults
    config = RuneConfig()
    
    # Override with file config
    file_config = load_config_file()
    if file_config:
        config = RuneConfig.from_dict({**config.to_dict(), **file_config})
    
    # Override with environment variables
    env_config = load_env_config()
    if env_config:
        config = RuneConfig.from_dict({**config.to_dict(), **env_config})
    
    return config


def save_config(config: RuneConfig) -> None:
    """Save configuration to file."""
    ensure_config_dir()
    config_path = get_config_path()
    
    # Don't save sensitive data to file
    config_dict = config.to_dict()
    config_dict.pop("db_password", None)
    
    config_path.write_text(json.dumps(config_dict, indent=2), encoding="utf-8")


def update_config(key: str, value: Any) -> RuneConfig:
    """Update a single configuration value."""
    config = get_config()
    if hasattr(config, key):
        setattr(config, key, value)
        save_config(config)
    return config


def reset_config() -> RuneConfig:
    """Reset configuration to defaults."""
    config = RuneConfig()
    save_config(config)
    return config


def get_config_value(key: str, default: Any = None) -> Any:
    """Get a specific configuration value."""
    config = get_config()
    return getattr(config, key, default)


def get_database_url() -> str:
    """Build database connection URL from config."""
    config = get_config()
    return f"postgresql://{config.db_user}:{config.db_password}@{config.db_host}:{config.db_port}/{config.db_name}"


# Export all public functions and classes
__all__ = [
    "RuneConfig",
    "get_config_dir",
    "get_config_path",
    "get_credentials_path",
    "ensure_config_dir",
    "get_config",
    "save_config",
    "update_config",
    "reset_config",
    "get_config_value",
    "get_database_url",
]

