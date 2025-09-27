""" "Configuration Management

This module handles all application configuration using Pydantic Settings.
It provides a centralized way to manage environment variables, secrets,
and application settings with automatic validation and type conversion.

The configuration is loaded from:
1. Environment variables
2. .env files
3. Default values defined in the settings class

Note: This uses Pydantic Settings for automatic environment variable
loading, validation, and type conversion. All settings should be
defined as class attributes with appropriate type hints.
"""

from pydantic_settings import BaseSettings
