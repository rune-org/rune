"""
Rune CLI - Main Entry Point

Professional command-line interface for the Rune Workflow Automation Platform.
"""

import click
import sys
from typing import Optional

from cli import __version__
from cli.styles import print_logo, console
from cli.commands import (
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


class RuneGroup(click.Group):
    """Custom Click Group with Rune branding and enhanced help."""

    def format_help(self, ctx: click.Context, formatter: click.HelpFormatter) -> None:
        """Format help with Rune branding."""
        print_logo(small=True)
        console.print()
        super().format_help(ctx, formatter)

    def get_command(self, ctx: click.Context, cmd_name: str) -> Optional[click.Command]:
        """Get command with alias support."""
        # Command aliases for common operations
        aliases = {
            "login": "auth",
            "logout": "auth", 
            "status": "auth",
            "reset": "db",
            "health": "admin",
            "wf": "workflow",
            "tpl": "template",
            "cred": "credential",
            "exec": "execution",
            "sh": "shell",
            "interactive": "shell",
            "i": "shell",
        }
        
        # If alias, redirect to parent command
        if cmd_name in aliases:
            return super().get_command(ctx, aliases[cmd_name])
        
        return super().get_command(ctx, cmd_name)


@click.group(cls=RuneGroup)
@click.version_option(version=__version__, prog_name="rune")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
@click.option(
    "--output", "-o",
    type=click.Choice(["text", "json"], case_sensitive=False),
    default="text",
    help="Output format (text or json)",
)
@click.option("--no-color", is_flag=True, help="Disable colored output")
@click.pass_context
def cli(ctx: click.Context, verbose: bool, output: str, no_color: bool) -> None:
    """
    Rune CLI - Workflow Automation Platform Management Tool

    A professional command-line interface for managing Rune workflows,
    templates, users, and database operations.

    \b
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    QUICK START
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    \b
    1. Configure API endpoint:
       $ rune config set-url http://localhost:8000

    \b
    2. Create admin account (first-time only):
       $ rune auth signup

    \b
    3. Login to your account:
       $ rune auth login

    \b
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    COMMON COMMANDS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    \b
    Authentication:
       rune auth login          Login to your account
       rune auth logout         Logout and clear credentials
       rune auth status         Check authentication status

    \b
    Workflows:
       rune workflow list       List all workflows
       rune workflow run ID     Execute a workflow
       rune workflow create     Create a new workflow

    \b
    Database (via Docker):
       rune db health           Check database connection
       rune db reset            Reset database to clean state
       rune db info             Show database information

    \b
    Administration:
       rune admin health        Check API server health
       rune admin stats         View system statistics
       rune admin users list    List all users

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
        from rich.console import Console
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
    from cli.shell import start_shell
    start_shell(cli)


def main() -> None:
    """Main entry point for the CLI."""
    # If no arguments provided, start interactive shell
    if len(sys.argv) == 1:
        from cli.shell import start_shell
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
