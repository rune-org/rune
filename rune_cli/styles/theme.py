"""
Terminal Styling and Theme

Rich terminal output with consistent theming, colors, and formatting.
"""

from rich.console import Console
from rich.theme import Theme
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.text import Text
from rich.box import ROUNDED, DOUBLE, SIMPLE
from rich import print as rprint
from typing import Optional, List, Any, Dict
import click

# Custom theme for Rune CLI
RUNE_THEME = Theme({
    "primary": "blue",
    "secondary": "cyan",
    "success": "green",
    "error": "red bold",
    "warning": "yellow",
    "info": "cyan",
    "muted": "dim",
    "highlight": "magenta",
    "header": "blue bold",
    "value": "white",
    "key": "cyan bold",
})

# Global console instance
console = Console(theme=RUNE_THEME)


# ASCII Art Logo
LOGO_LARGE = """
[blue bold]╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║            ██████╗ ██╗   ██╗███╗   ██╗███████╗                        ║
║            ██╔══██╗██║   ██║████╗  ██║██╔════╝                        ║
║            ██████╔╝██║   ██║██╔██╗ ██║█████╗                          ║
║            ██╔══██╗██║   ██║██║╚██╗██║██╔══╝                          ║
║            ██║  ██║╚██████╔╝██║ ╚████║███████╗                        ║
║            ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝                        ║
║                                                                       ║
║              Workflow Automation Platform - CLI v1.0.0                ║
║                        Professional Edition                           ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝[/blue bold]
"""

LOGO_SMALL = """[blue bold]╔════════════════════════════╗
║      RUNE CLI v1.0.0       ║
╚════════════════════════════╝[/blue bold]"""


def print_logo(small: bool = False) -> None:
    """Print the Rune CLI logo."""
    console.print(LOGO_SMALL if small else LOGO_LARGE)


def print_header(title: str, subtitle: str = "") -> None:
    """Print a styled header."""
    console.print()
    header_text = Text(title, style="header")
    if subtitle:
        header_text.append(f"\n{subtitle}", style="muted")
    console.print(Panel(header_text, box=DOUBLE, border_style="primary", padding=(0, 2)))
    console.print()


def print_success(message: str) -> None:
    """Print a success message."""
    console.print(f"[success]✓[/success] {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    console.print(f"[error]✗ Error:[/error] {message}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    console.print(f"[warning]⚠ Warning:[/warning] {message}")


def print_info(message: str) -> None:
    """Print an info message."""
    console.print(f"[info]ℹ[/info] {message}")


def print_muted(message: str) -> None:
    """Print a muted message."""
    console.print(f"[muted]{message}[/muted]")


def print_step(current: int, total: int, text: str) -> None:
    """Print a step indicator."""
    console.print(f"[primary][{current}/{total}][/primary] {text}")


def print_divider(char: str = "─", length: int = 60) -> None:
    """Print a divider line."""
    console.print(f"[muted]{char * length}[/muted]")


def print_key_value(key: str, value: Any, masked: bool = False) -> None:
    """Print a key-value pair."""
    display_value = "********" if masked and value else str(value)
    console.print(f"  [key]{key}:[/key] [value]{display_value}[/value]")


def print_table(
    columns: List[str],
    rows: List[List[Any]],
    title: str = "",
    show_header: bool = True,
    box_style=ROUNDED,
) -> None:
    """Print a formatted table."""
    table = Table(
        title=title if title else None,
        box=box_style,
        header_style="blue bold",
        border_style="dim",
        show_header=show_header,
    )
    
    for col in columns:
        table.add_column(col, style="white")
    
    for row in rows:
        table.add_row(*[str(cell) for cell in row])
    
    console.print(table)


def print_dict_table(data: Dict[str, Any], title: str = "") -> None:
    """Print a dictionary as a two-column table."""
    table = Table(
        title=title if title else None,
        box=SIMPLE,
        header_style="blue bold",
        border_style="dim",
        show_header=True,
    )
    
    table.add_column("Property", style="cyan bold")
    table.add_column("Value", style="white")
    
    for key, value in data.items():
        table.add_row(str(key), str(value))
    
    console.print(table)


def print_json(data: Any) -> None:
    """Print JSON formatted data."""
    import json
    console.print_json(json.dumps(data, indent=2, default=str))


def print_panel(content: str, title: str = "", style: str = "primary") -> None:
    """Print content in a panel."""
    console.print(Panel(content, title=title, border_style=style, box=ROUNDED))


def create_progress() -> Progress:
    """Create a progress bar."""
    return Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    )


def confirm_action(prompt: str, default: bool = False) -> bool:
    """Prompt user for confirmation."""
    return click.confirm(click.style(f"❓ {prompt}", fg="yellow"), default=default)


def prompt_input(prompt: str, default: Optional[str] = None, hide_input: bool = False) -> str:
    """Prompt user for input."""
    styled_prompt = click.style(f"❯ {prompt}", fg="cyan", bold=True)
    return click.prompt(styled_prompt, default=default, hide_input=hide_input, show_default=not hide_input)


def print_status_badge(status: str) -> str:
    """Return a colored status badge."""
    status_colors = {
        "success": "[green]● SUCCESS[/green]",
        "running": "[blue]● RUNNING[/blue]",
        "pending": "[yellow]● PENDING[/yellow]",
        "failed": "[red]● FAILED[/red]",
        "cancelled": "[muted]● CANCELLED[/muted]",
        "active": "[green]● ACTIVE[/green]",
        "inactive": "[muted]● INACTIVE[/muted]",
        "healthy": "[green]● HEALTHY[/green]",
        "unhealthy": "[red]● UNHEALTHY[/red]",
        "connected": "[green]● CONNECTED[/green]",
        "disconnected": "[red]● DISCONNECTED[/red]",
    }
    return status_colors.get(status.lower(), f"[muted]● {status.upper()}[/muted]")


# Export all public functions
__all__ = [
    "console",
    "print_logo",
    "print_header",
    "print_success",
    "print_error",
    "print_warning",
    "print_info",
    "print_muted",
    "print_step",
    "print_divider",
    "print_key_value",
    "print_table",
    "print_dict_table",
    "print_json",
    "print_panel",
    "create_progress",
    "confirm_action",
    "prompt_input",
    "print_status_badge",
]

