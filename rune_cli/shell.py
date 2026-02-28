"""
Rune Interactive Shell

Interactive REPL-style shell for running multiple commands without exiting.
"""

import click
import shlex
import sys
import os
from typing import Optional, List
from datetime import datetime

from rune_cli import __version__
from rune_cli.styles import (
    console,
    print_error,
)
from rune_cli.core.config import get_config
from rune_cli.auth import get_token_manager


# Shell ASCII Art
SHELL_BANNER = """
[blue bold]
    ██████╗ ██╗   ██╗███╗   ██╗███████╗     ██████╗██╗     ██╗
    ██╔══██╗██║   ██║████╗  ██║██╔════╝    ██╔════╝██║     ██║
    ██████╔╝██║   ██║██╔██╗ ██║█████╗      ██║     ██║     ██║
    ██╔══██╗██║   ██║██║╚██╗██║██╔══╝      ██║     ██║     ██║
    ██║  ██║╚██████╔╝██║ ╚████║███████╗    ╚██████╗███████╗██║
    ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝     ╚═════╝╚══════╝╚═╝
[/blue bold]
[cyan]    ═══════════════════════════════════════════════════════════[/cyan]
[white]              Workflow Automation Platform v{version}[/white]
[cyan]    ═══════════════════════════════════════════════════════════[/cyan]
"""

WELCOME_MESSAGE = """
[green]✓[/green] Welcome to the Rune Interactive Shell!

[cyan]Quick Commands:[/cyan]
  [white]help[/white]          Show all available commands
  [white]status[/white]        Check authentication & system status
  [white]login[/white]         Login to your account
  [white]logout[/white]        Logout from current session
  [white]clear[/white]         Clear the screen
  [white]exit[/white]          Exit the shell

[cyan]Examples:[/cyan]
  [dim]>[/dim] [white]db health[/white]              Check database connection
  [dim]>[/dim] [white]workflow list[/white]          List all workflows  
  [dim]>[/dim] [white]admin stats[/white]            View system statistics
  [dim]>[/dim] [white]auth signup[/white]            Create first admin account

[dim]Type 'help' for full command list or '<command> --help' for details.[/dim]
"""


class RuneShell:
    """Interactive shell for Rune CLI."""
    
    BUILTIN_COMMANDS = {
        'exit': 'Exit the shell',
        'quit': 'Exit the shell',
        'clear': 'Clear the screen',
        'cls': 'Clear the screen',
        'help': 'Show help information',
        '?': 'Show help information',
        'status': 'Quick authentication status',
        'login': 'Quick login command',
        'logout': 'Quick logout command',
        'version': 'Show version information',
        'history': 'Show command history',
    }
    
    def __init__(self, cli_group: click.Group):
        """Initialize the shell with the main CLI group."""
        self.cli = cli_group
        self.running = False
        self.history: List[str] = []
        self.config = get_config()
        self.token_manager = get_token_manager()
        
    def print_banner(self):
        """Print the welcome banner."""
        console.print(SHELL_BANNER.format(version=__version__))
        
    def print_welcome(self):
        """Print welcome message with quick commands."""
        console.print(WELCOME_MESSAGE)
        
    def print_status_bar(self) -> str:
        """Generate status information for the prompt."""
        # Check auth status
        if self.token_manager.is_authenticated():
            info = self.token_manager.get_token_info()
            email = info.get("email", "user")
            if info.get("is_expired"):
                return f"[yellow]{email}[/yellow] [red](expired)[/red]"
            return f"[green]{email}[/green]"
        return "[dim]not logged in[/dim]"
        
    def get_prompt(self) -> str:
        """Generate the shell prompt."""
        status = self.print_status_bar()
        return f"\n[cyan]rune[/cyan] [{status}] [blue]>[/blue] "
    
    def handle_builtin(self, cmd: str, args: List[str]) -> bool:
        """
        Handle built-in shell commands.
        
        Returns True if command was handled, False otherwise.
        """
        cmd_lower = cmd.lower()
        
        if cmd_lower in ('exit', 'quit'):
            self.running = False
            console.print("\n[cyan]Goodbye! 👋[/cyan]\n")
            return True
            
        elif cmd_lower in ('clear', 'cls'):
            os.system('cls' if os.name == 'nt' else 'clear')
            self.print_banner()
            return True
            
        elif cmd_lower in ('help', '?'):
            self.show_help()
            return True
            
        elif cmd_lower == 'status':
            self.show_quick_status()
            return True
            
        elif cmd_lower == 'login':
            # Redirect to auth login
            return False  # Let CLI handle it
            
        elif cmd_lower == 'logout':
            # Redirect to auth logout  
            return False  # Let CLI handle it
            
        elif cmd_lower == 'version':
            console.print(f"[cyan]Rune CLI[/cyan] version [green]{__version__}[/green]")
            return True
            
        elif cmd_lower == 'history':
            self.show_history()
            return True
            
        return False
    
    def show_help(self):
        """Display help information."""
        console.print("\n[cyan bold]═══ Rune CLI Commands ═══[/cyan bold]\n")
        
        # Built-in commands
        console.print("[yellow]Shell Commands:[/yellow]")
        for cmd, desc in self.BUILTIN_COMMANDS.items():
            console.print(f"  [white]{cmd:12}[/white] {desc}")
        
        console.print("\n[yellow]Main Commands:[/yellow]")
        console.print("  [white]auth         [/white] Authentication (login, logout, signup, status)")
        console.print("  [white]config       [/white] Configuration management")
        console.print("  [white]db           [/white] Database operations (health, reset, info, tables)")
        console.print("  [white]admin        [/white] Administrative commands (health, stats, users)")
        console.print("  [white]workflow     [/white] Workflow management (list, run, create, delete)")
        console.print("  [white]template     [/white] Template management")
        console.print("  [white]credential   [/white] Credential management")
        console.print("  [white]execution    [/white] Execution history")
        console.print("  [white]user         [/white] User profile management")
        
        console.print("\n[dim]Type '<command> --help' for detailed command options.[/dim]")
        console.print("[dim]Example: 'db reset --help'[/dim]\n")
        
    def show_quick_status(self):
        """Show quick status overview."""
        console.print("\n[cyan bold]═══ System Status ═══[/cyan bold]\n")
        
        # Auth status
        if self.token_manager.is_authenticated():
            info = self.token_manager.get_token_info()
            if info.get("is_expired"):
                console.print("  [yellow]●[/yellow] Authentication: [yellow]Token Expired[/yellow]")
            else:
                console.print(f"  [green]●[/green] Authentication: [green]Logged in[/green] as {info.get('email')}")
        else:
            console.print("  [red]●[/red] Authentication: [dim]Not logged in[/dim]")
        
        # Config status
        console.print(f"  [blue]●[/blue] API URL: {self.config.api_url}")
        console.print(f"  [blue]●[/blue] DB Container: {self.config.docker_container}")
        console.print()
        
    def show_history(self):
        """Show command history."""
        if not self.history:
            console.print("[dim]No command history yet.[/dim]")
            return
            
        console.print("\n[cyan bold]═══ Command History ═══[/cyan bold]\n")
        for i, cmd in enumerate(self.history[-20:], 1):
            console.print(f"  [dim]{i:3}.[/dim] {cmd}")
        console.print()
    
    def execute_command(self, command_line: str):
        """Execute a CLI command."""
        if not command_line.strip():
            return
            
        # Add to history
        self.history.append(command_line)
        
        try:
            # Parse command line
            parts = shlex.split(command_line)
            if not parts:
                return
                
            cmd = parts[0].lower()
            args = parts[1:]
            
            # Check for built-in commands first
            if self.handle_builtin(cmd, args):
                return
            
            # Handle shortcut commands
            shortcuts = {
                'login': ['auth', 'login'],
                'logout': ['auth', 'logout'],
                'signup': ['auth', 'signup'],
            }
            
            if cmd in shortcuts:
                parts = shortcuts[cmd] + args
            
            # Execute through Click
            with self.cli.make_context('rune', parts, standalone_mode=False) as ctx:
                self.cli.invoke(ctx)
                
        except click.ClickException as e:
            e.show()
        except click.Abort:
            pass  # User cancelled
        except SystemExit:
            pass  # Normal exit from command
        except Exception as e:
            print_error(f"Command failed: {e}")
    
    def run(self):
        """Run the interactive shell."""
        self.running = True
        
        # Clear screen and show banner
        os.system('cls' if os.name == 'nt' else 'clear')
        self.print_banner()
        self.print_welcome()
        
        # Check if first-time setup is needed
        self._check_first_time_setup()
        
        while self.running:
            try:
                # Get prompt with status
                prompt = self.get_prompt()
                console.print(prompt, end="")
                
                # Read command
                command = input().strip()
                
                if command:
                    self.execute_command(command)
                    
            except KeyboardInterrupt:
                console.print("\n[dim]Press Ctrl+C again or type 'exit' to quit.[/dim]")
            except EOFError:
                self.running = False
                console.print("\n[cyan]Goodbye! 👋[/cyan]\n")
    
    def _check_first_time_setup(self):
        """Check if first-time setup is available and prompt user."""
        try:
            from rune_cli.client import get_api_client
            client = get_api_client()
            status = client.check_first_time_setup()
            
            if status.get("is_first_time_setup"):
                console.print()
                console.print("[yellow]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/yellow]")
                console.print("[yellow]  📋 First-Time Setup Detected![/yellow]")
                console.print("[yellow]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/yellow]")
                console.print()
                console.print("  No admin account exists yet. Create one with:")
                console.print("  [cyan]> auth signup[/cyan]")
                console.print("  [dim]or[/dim]")
                console.print("  [cyan]> signup[/cyan]")
                console.print()
        except Exception:
            pass  # Silently ignore if API is not available


def start_shell(cli_group: click.Group):
    """Start the interactive Rune shell."""
    shell = RuneShell(cli_group)
    shell.run()

