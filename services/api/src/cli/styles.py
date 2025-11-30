"""
Rune CLI Styling and Branding

Maintains Rune's visual identity throughout the CLI experience.
"""

import click
from typing import Optional

# Rune brand colors (adapted for terminal)
RUNE_PRIMARY = "cyan"
RUNE_SECONDARY = "magenta"
RUNE_SUCCESS = "green"
RUNE_WARNING = "yellow"
RUNE_ERROR = "red"
RUNE_INFO = "blue"

# Rune ASCII Art Logo
RUNE_LOGO = r"""
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║             ██████╗ ██╗   ██╗███╗   ██╗███████╗               ║
║             ██╔══██╗██║   ██║████╗  ██║██╔════╝               ║
║             ██████╔╝██║   ██║██╔██╗ ██║█████╗                 ║
║             ██╔══██╗██║   ██║██║╚██╗██║██╔══╝                 ║
║             ██║  ██║╚██████╔╝██║ ╚████║███████╗               ║
║             ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝               ║
║                                                               ║
║               Workflow Automation Platform                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"""

RUNE_LOGO_SMALL = r"""
    ____  __  ___   ____________
   / __ \/ / / / | / / ____/
  / /_/ / / / /  |/ / __/  
 / _, _/ /_/ / /|  / /___  
/_/ |_|\____/_/ |_/_____/  
"""


def print_logo(small: bool = False) -> None:
    """Print the Rune logo."""
    logo = RUNE_LOGO_SMALL if small else RUNE_LOGO
    click.echo(click.style(logo, fg=RUNE_PRIMARY, bold=True))


def print_header(text: str) -> None:
    """Print a styled header."""
    border = "═" * (len(text) + 4)
    click.echo()
    click.echo(click.style(f"╔{border}╗", fg=RUNE_PRIMARY))
    click.echo(click.style(f"║  {text}  ║", fg=RUNE_PRIMARY, bold=True))
    click.echo(click.style(f"╚{border}╝", fg=RUNE_PRIMARY))
    click.echo()


def print_success(message: str) -> None:
    """Print a success message."""
    click.echo(click.style(f"✓ {message}", fg=RUNE_SUCCESS, bold=True))


def print_error(message: str) -> None:
    """Print an error message."""
    click.echo(click.style(f"✗ {message}", fg=RUNE_ERROR, bold=True))


def print_warning(message: str) -> None:
    """Print a warning message."""
    click.echo(click.style(f"⚠ {message}", fg=RUNE_WARNING, bold=True))


def print_info(message: str) -> None:
    """Print an info message."""
    click.echo(click.style(f"ℹ {message}", fg=RUNE_INFO))


def print_step(step: int, total: int, message: str) -> None:
    """Print a step in a process."""
    click.echo(click.style(f"[{step}/{total}] ", fg=RUNE_SECONDARY) + message)


def print_divider() -> None:
    """Print a divider line."""
    click.echo(click.style("─" * 60, fg=RUNE_PRIMARY))


def print_table_header(columns: list[str], widths: list[int]) -> None:
    """Print a table header."""
    header = ""
    for col, width in zip(columns, widths):
        header += click.style(f"{col:<{width}}", fg=RUNE_PRIMARY, bold=True)
    click.echo(header)
    click.echo(click.style("─" * sum(widths), fg=RUNE_PRIMARY))


def print_table_row(
    values: list[str], widths: list[int], highlight: Optional[str] = None
) -> None:
    """Print a table row."""
    row = ""
    for val, width in zip(values, widths):
        styled_val = (
            click.style(f"{val:<{width}}", fg=highlight)
            if highlight
            else f"{val:<{width}}"
        )
        row += styled_val
    click.echo(row)


def confirm_action(message: str, default: bool = False) -> bool:
    """Prompt for confirmation with Rune styling."""
    return click.confirm(click.style(f"? {message}", fg=RUNE_WARNING), default=default)


def prompt_input(
    message: str, default: Optional[str] = None, hide_input: bool = False
) -> str:
    """Prompt for input with Rune styling."""
    return click.prompt(
        click.style(f"→ {message}", fg=RUNE_SECONDARY),
        default=default,
        hide_input=hide_input,
    )


def print_config_value(key: str, value: str, masked: bool = False) -> None:
    """Print a configuration key-value pair."""
    display_value = "****" if masked else value
    click.echo(
        click.style(f"  {key}: ", fg=RUNE_SECONDARY)
        + click.style(display_value, fg="white")
    )


def print_version() -> None:
    """Print version information."""
    from . import __version__

    click.echo(click.style(f"Rune CLI v{__version__}", fg=RUNE_PRIMARY, bold=True))
