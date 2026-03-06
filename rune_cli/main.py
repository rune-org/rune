"""
Rune CLI - Main Entry Point

Professional command-line interface for the Rune Workflow Automation Platform.
"""

import click
import sys
from typing import Optional, Tuple

from rune_cli import __version__
from rune_cli.core.config import get_config
from rune_cli.styles import print_logo, console
from rune_cli.commands import (
    auth,
    config,
    db,
    admin,
    workflow,
    template,
    credential,
    execution,
    user,
)


# Aliases that map to subcommands: alias -> (group_name, subcommand_name)
SUBCOMMAND_ALIASES: dict[str, Tuple[str, str]] = {
    "login": ("auth", "login"),
    "logout": ("auth", "logout"),
    "signup": ("auth", "signup"),
    "status": ("auth", "status"),
    "reset": ("db", "reset"),
    "health": ("admin", "health"),
}

# Aliases that map to groups: alias -> group_name
GROUP_ALIASES: dict[str, str] = {
    "wf": "workflow",
    "tpl": "template",
    "cred": "credential",
    "exec": "execution",
    "sh": "shell",
    "interactive": "shell",
    "i": "shell",
}


class RuneGroup(click.Group):
    """Custom Click Group with Rune branding and enhanced help."""

    def format_help(self, ctx: click.Context, formatter: click.HelpFormatter) -> None:
        """Format help with Rune branding."""
        print_logo(small=True)
        console.print()
        super().format_help(ctx, formatter)

    def get_command(self, ctx: click.Context, cmd_name: str) -> Optional[click.Command]:
        """Get command with alias support for both groups and subcommands."""
        # Check if this is a subcommand alias (e.g., login -> auth login)
        if cmd_name in SUBCOMMAND_ALIASES:
            group_name, subcmd_name = SUBCOMMAND_ALIASES[cmd_name]
            # Get the group command
            group = super().get_command(ctx, group_name)
            if group and isinstance(group, click.MultiCommand):
                # Return the subcommand directly
                return group.get_command(ctx, subcmd_name)
        
        # Check if this is a group alias (e.g., wf -> workflow)
        if cmd_name in GROUP_ALIASES:
            return super().get_command(ctx, GROUP_ALIASES[cmd_name])
        
        return super().get_command(ctx, cmd_name)


@click.group(cls=RuneGroup)
@click.version_option(version=__version__, prog_name="rune")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
@click.option(
    "--output", "-o",
    type=click.Choice(["text", "json"], case_sensitive=False),
    default=lambda: get_config().default_output_format,
    show_default="text",
    help="Output format (text or json); default taken from config/RUNE_OUTPUT_FORMAT.",
)
@click.option(
    "--no-color",
    is_flag=True,
    default=lambda: not get_config().color_enabled,
    help="Disable colored output; default taken from config/RUNE_COLOR.",
)
@click.pass_context
def cli(ctx: click.Context, verbose: bool, output: str, no_color: bool) -> None:
    """
    Rune CLI - Workflow Automation Platform Management Tool

    A professional command-line interface for managing Rune workflows,
    templates, users, and database operations.

    \b
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ARCHITECTURE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    \b
    The CLI communicates with the Rune API server over HTTP:

    \b
       CLI ──HTTP──► API Server ──SQL──► Database
       (this)        (port 8000)         (PostgreSQL)

    \b
    ⚠ The API server must be running for most commands to work.
    Start it with: cd services/api && docker compose up -d

    \b
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    QUICK START
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    \b
    1. Start the API server (if not running):
       $ cd services/api && docker compose up -d

    \b
    2. Configure API endpoint (if different from default):
       $ rune config set-url http://localhost:8000

    \b
    3. Create admin account (first-time only):
       $ rune auth signup

    \b
    4. Login to your account:
       $ rune auth login

    \b
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    COMMON COMMANDS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    \b
    Authentication (requires API):
       rune auth login          Login to your account
       rune auth logout         Logout and clear credentials
       rune auth status         Check authentication status

    \b
    Workflows (requires API):
       rune workflow list       List all workflows
       rune workflow run ID     Execute a workflow
       rune workflow create     Create a new workflow

    \b
    Configuration (works offline):
       rune config show         Show current configuration
       rune config set-url URL  Set API server URL

    \b
    Database (via Docker, works offline):
       rune db health           Check database connection
       rune db reset            Reset database to clean state

    \b
    Administration (requires API):
       rune admin health        Check API server health
       rune admin stats         View system statistics

    \b
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    OUTPUT OPTIONS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    \b
    Use -o json for machine-readable output:
       $ rune workflow list -o json
       $ rune admin stats -o json

    \b
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    HELP & SUPPORT
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    \b
    Get help for any command:
       $ rune COMMAND --help
       $ rune workflow --help
       $ rune db reset --help

    \b
    Documentation: https://docs.rune.io
    Support: runeteam1011@gmail.com
    """
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose
    ctx.obj["output"] = output
    ctx.obj["no_color"] = no_color
    
    # Disable colors if requested
    if no_color:
        console._force_terminal = False


# Register command groups
cli.add_command(auth)
cli.add_command(config)
cli.add_command(db)
cli.add_command(admin)
cli.add_command(workflow)
cli.add_command(template)
cli.add_command(credential)
cli.add_command(execution)
cli.add_command(user)


@cli.command("shell")
@click.pass_context
def shell_command(ctx):
    """
    Start interactive shell mode.

    \b
    Opens the Rune interactive shell where you can run multiple
    commands without exiting. Features include:
    
    • Command history
    • Auto-completion hints
    • Quick status display
    • Built-in help system
    
    \b
    Aliases: shell, sh, interactive, i
    
    \b
    Examples:
        rune shell
        rune sh
        rune i
    """
    from rune_cli.shell import start_shell
    start_shell(cli)


def main() -> None:
    """Main entry point for the CLI."""
    # If no arguments provided, start interactive shell
    if len(sys.argv) == 1:
        from rune_cli.shell import start_shell
        start_shell(cli)
        return
    
    try:
        cli()
    except KeyboardInterrupt:
        console.print("\n[warning]Operation cancelled by user.[/warning]")
        sys.exit(0)
    except Exception as e:
        console.print(f"\n[error]✗ Unexpected error: {e}[/error]")
        sys.exit(1)


if __name__ == "__main__":
    main()

