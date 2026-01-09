"""
Core Package

Core utilities for configuration, database, and Docker operations.
"""

from cli.core.config import (
    RuneConfig,
    get_config,
    save_config,
    update_config,
    reset_config,
    get_config_value,
    get_config_dir,
    get_config_path,
    get_credentials_path,
)

from cli.core.docker import (
    DockerError,
    DockerClient,
    get_docker_client,
)

from cli.core.database import (
    DatabaseError,
    DatabaseManager,
    get_database_manager,
)

__all__ = [
    # Config
    "RuneConfig",
    "get_config",
    "save_config",
    "update_config",
    "reset_config",
    "get_config_value",
    "get_config_dir",
    "get_config_path",
    "get_credentials_path",
    # Docker
    "DockerError",
    "DockerClient",
    "get_docker_client",
    # Database
    "DatabaseError",
    "DatabaseManager",
    "get_database_manager",
]
