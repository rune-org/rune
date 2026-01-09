"""
Configuration Commands

Commands for managing CLI configuration.
"""

import click

from cli.core import (
    get_config,
    update_config,
    reset_config,
    get_config_dir,
    get_config_path,
    get_credentials_path,
)
from cli.styles import (
    print_header,
    print_success,
    print_error,
    print_info,
    print_divider,
    print_key_value,
    print_json,
    confirm_action,
    console,
)
from cli.utils import validate_url


@click.group()
def config():
    """
    Configuration management commands.

    \b
    View and manage CLI configuration settings.
    
    \b
    Quick Commands:
        rune config show         Display current configuration
        rune config set-url URL  Set API server URL
        rune config reset        Reset to default settings
    """
    pass


@config.command("show")
@click.pass_context
def show_config(ctx):
    """
    Display current configuration.

    \b
    Shows all configuration values from file and environment.

    \b
    Examples:
        rune config show
        rune config show -o json
    """
    output_format = ctx.obj.get("output", "text")
    
    cfg = get_config()
    
    if output_format == "json":
        print_json(cfg.to_dict())
    else:
        print_header("Rune CLI Configuration")
        
        console.print("[primary]API Settings[/primary]")
        print_key_value("API URL", cfg.api_url)
        print_key_value("Timeout", f"{cfg.timeout} seconds")
        print_key_value("Verify SSL", str(cfg.verify_ssl))
        
        print_divider()
        console.print("[primary]Database Settings[/primary]")
        print_key_value("Host", cfg.db_host)
        print_key_value("Port", str(cfg.db_port))
        print_key_value("Database", cfg.db_name)
        print_key_value("User", cfg.db_user)
        print_key_value("Password", cfg.db_password, masked=True)
        
        print_divider()
        console.print("[primary]Docker Settings[/primary]")
        print_key_value("Container", cfg.docker_container)
        
        print_divider()
        console.print("[primary]File Locations[/primary]")
        print_key_value("Config Dir", str(get_config_dir()))
        print_key_value("Config File", str(get_config_path()))
        print_key_value("Credentials", str(get_credentials_path()))


@config.command("set")
@click.argument("key")
@click.argument("value")
@click.pass_context
def set_config(ctx, key: str, value: str):
    """
    Set a configuration value.

    \b
    Available keys:
        api_url          - API server URL
        timeout          - Request timeout (seconds)
        verify_ssl       - SSL verification (true/false)
        db_host          - Database host
        db_port          - Database port
        db_name          - Database name
        db_user          - Database user
        db_password      - Database password
        docker_container - Docker container name

    \b
    Examples:
        rune config set api_url http://localhost:8000
        rune config set timeout 60
        rune config set docker_container rune-db-1
    """
    output_format = ctx.obj.get("output", "text")
    
    # Validate specific keys
    if key == "api_url":
        is_valid, error = validate_url(value)
        if not is_valid:
            print_error(error)
            raise click.Abort()
    
    # Convert value types
    if key in ("timeout", "db_port"):
        try:
            value = int(value)
        except ValueError:
            print_error(f"{key} must be an integer")
            raise click.Abort()
    elif key in ("verify_ssl", "color_enabled", "verbose"):
        value = value.lower() in ("true", "1", "yes")
    
    # Check if key is valid
    cfg = get_config()
    if not hasattr(cfg, key):
        print_error(f"Unknown configuration key: {key}")
        print_info("Run 'rune config show' to see available keys")
        raise click.Abort()
    
    # Update config
    update_config(key, value)
    
    if output_format == "json":
        print_json({"success": True, "key": key, "value": value})
    else:
        print_success(f"Configuration updated: {key} = {value}")


@config.command("set-url")
@click.argument("url")
@click.pass_context
def set_url(ctx, url: str):
    """
    Set the API base URL.

    \b
    Examples:
        rune config set-url http://localhost:8000
        rune config set-url https://api.rune.io
    """
    output_format = ctx.obj.get("output", "text")
    
    # Validate URL
    is_valid, error = validate_url(url)
    if not is_valid:
        print_error(error)
        raise click.Abort()
    
    update_config("api_url", url)
    
    if output_format == "json":
        print_json({"success": True, "api_url": url})
    else:
        print_success(f"API URL set to: {url}")


@config.command("set-container")
@click.argument("container_name")
@click.pass_context
def set_container(ctx, container_name: str):
    """
    Set the Docker database container name.

    \b
    Examples:
        rune config set-container rune-db-1
        rune config set-container postgres
    """
    output_format = ctx.obj.get("output", "text")
    
    update_config("docker_container", container_name)
    
    if output_format == "json":
        print_json({"success": True, "docker_container": container_name})
    else:
        print_success(f"Docker container set to: {container_name}")


@config.command("reset")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation prompt")
@click.pass_context
def reset(ctx, force: bool):
    """
    Reset configuration to defaults.

    \b
    Examples:
        rune config reset
        rune config reset --force
    """
    output_format = ctx.obj.get("output", "text")
    
    if not force and output_format == "text":
        if not confirm_action("Reset all configuration to defaults?"):
            print_info("Reset cancelled")
            return
    
    cfg = reset_config()
    
    if output_format == "json":
        print_json({"success": True, "config": cfg.to_dict()})
    else:
        print_success("Configuration reset to defaults")
        print_divider()
        print_info(f"API URL: {cfg.api_url}")
        print_info(f"Timeout: {cfg.timeout} seconds")
        print_info(f"Docker Container: {cfg.docker_container}")


@config.command("path")
@click.pass_context
def config_path(ctx):
    """
    Show configuration file paths.

    \b
    Examples:
        rune config path
    """
    output_format = ctx.obj.get("output", "text")
    
    paths = {
        "config_dir": str(get_config_dir()),
        "config_file": str(get_config_path()),
        "credentials_file": str(get_credentials_path()),
    }
    
    if output_format == "json":
        print_json(paths)
    else:
        print_header("Configuration Paths")
        print_key_value("Config Directory", paths["config_dir"])
        print_key_value("Config File", paths["config_file"])
        print_key_value("Credentials File", paths["credentials_file"])
