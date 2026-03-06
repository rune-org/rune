"""
Output Utilities

Formatters for JSON, tables, and datetime output.
"""

import json
from datetime import datetime, timezone
from typing import Any, Optional, List, Dict
from rune_cli.styles import print_json as styled_print_json, print_table as styled_print_table


def format_datetime(dt: Any) -> str:
    """Format datetime for display."""
    if dt is None:
        return "N/A"
    
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except ValueError:
            return dt
    
    if isinstance(dt, datetime):
        # Convert to local time if timezone aware
        if dt.tzinfo is not None:
            try:
                local_dt = dt.astimezone()
                return local_dt.strftime("%Y-%m-%d %H:%M:%S")
            except (OSError, ValueError):
                pass
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    
    return str(dt)


def format_relative_time(dt: Any) -> str:
    """Format datetime as relative time (e.g., '2 hours ago')."""
    if dt is None:
        return "N/A"
    
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except ValueError:
            return dt
    
    if not isinstance(dt, datetime):
        return str(dt)
    
    # Ensure both times are timezone aware
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    diff = now - dt
    seconds = int(diff.total_seconds())
    
    if seconds < 0:
        return "in the future"
    elif seconds < 60:
        return "just now"
    elif seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
    elif seconds < 86400:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    elif seconds < 604800:
        days = seconds // 86400
        return f"{days} day{'s' if days > 1 else ''} ago"
    else:
        return format_datetime(dt)


def format_size(size_bytes: int) -> str:
    """Format byte size for display."""
    if size_bytes is None:
        return "N/A"
    
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if abs(size_bytes) < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    
    return f"{size_bytes:.1f} PB"


def truncate_string(s: str, max_length: int = 50, suffix: str = "...") -> str:
    """Truncate string to max length."""
    if not s:
        return ""
    if len(s) <= max_length:
        return s
    return s[:max_length - len(suffix)] + suffix


def print_json_output(data: Any) -> None:
    """Print data as formatted JSON."""
    styled_print_json(data)


def print_table_output(
    columns: List[str],
    rows: List[List[Any]],
    title: str = "",
) -> None:
    """Print data as formatted table."""
    styled_print_table(columns, rows, title=title)


def format_list_output(
    items: List[Dict[str, Any]],
    columns: List[str],
    key_mapping: Optional[Dict[str, str]] = None,
    formatters: Optional[Dict[str, callable]] = None,
) -> List[List[Any]]:
    """
    Format list of dicts for table display.
    
    Args:
        items: List of dictionaries
        columns: Column names (keys from dict)
        key_mapping: Map display column to dict key
        formatters: Custom formatters for columns
    """
    key_mapping = key_mapping or {}
    formatters = formatters or {}
    
    rows = []
    for item in items:
        row = []
        for col in columns:
            key = key_mapping.get(col, col)
            value = item.get(key, "")
            
            # Apply formatter if available
            if col in formatters:
                value = formatters[col](value)
            
            row.append(value)
        rows.append(row)
    
    return rows


class OutputFormatter:
    """Context-aware output formatter."""
    
    def __init__(self, format_type: str = "text"):
        """Initialize formatter."""
        self.format_type = format_type
    
    def output(self, data: Any, columns: Optional[List[str]] = None, title: str = "") -> None:
        """Output data in the configured format."""
        if self.format_type == "json":
            print_json_output(data)
        elif isinstance(data, list) and columns:
            if data and isinstance(data[0], dict):
                rows = format_list_output(data, columns)
                print_table_output(columns, rows, title)
            else:
                print_table_output(columns, data, title)
        else:
            print_json_output(data)


# Export all public functions and classes
__all__ = [
    "format_datetime",
    "format_relative_time",
    "format_size",
    "truncate_string",
    "print_json_output",
    "print_table_output",
    "format_list_output",
    "OutputFormatter",
]

