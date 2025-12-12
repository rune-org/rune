"""
Rune CLI - Main Entry Point

The main command group for the Rune CLI application.
"""

import click
import asyncio
from functools import wraps
from typing import Callable, Any

from .styles import print_logo
from . import __version__

# Import command groups at module level to avoid E402
from .commands import admin, auth, db, config


def async_command(f: Callable) -> Callable:
    """Decorator to run async functions in click commands."""

    @wraps(f)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        return asyncio.run(f(*args, **kwargs))

    return wrapper


class RuneGroup(click.Group):
    """Custom Click Group with Rune branding."""

    def format_help(self, ctx: click.Context, formatter: click.HelpFormatter) -> None:
        """Format help with Rune branding."""
        print_logo(small=False)
        click.echo()
        super().format_help(ctx, formatter)


@click.group(cls=RuneGroup)
@click.version_option(version=__version__, prog_name="rune")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
@click.pass_context
def cli(ctx: click.Context, verbose: bool) -> None:
    """
    Rune CLI - Workflow Automation Platform Management Tool

    A command-line interface for managing Rune's administrative operations,
    database management, user authentication, and more.

    \b
    Examples:
        rune admin create-user --email admin@example.com --admin
        rune db reset --confirm
        rune auth login --email admin@example.com
        rune config show
    """
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose


# Register command groups
cli.add_command(admin.admin)
cli.add_command(auth.auth)
cli.add_command(db.db)
cli.add_command(config.config)


def main() -> None:
    """Main entry point for the CLI."""
    cli()


if __name__ == "__main__":
    main()
