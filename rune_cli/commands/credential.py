"""
Credential Commands

Commands for managing credentials.
"""

import click

from rune_cli.client import get_api_client, APIError
from rune_cli.styles import (
    print_header,
    print_success,
    print_error,
    print_info,
    print_divider,
    print_key_value,
    print_table,
    print_json,
    confirm_action,
)
from rune_cli.utils import format_datetime, truncate_string


@click.group()
def credential():
    """
    Credential management commands.

    \b
    Manage credentials for workflow integrations.
    """
    pass


@credential.command("list")
@click.pass_context
def list_credentials(ctx):
    """
    List all credentials.

    \b
    Examples:
        rune credential list
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Credentials")

    try:
        client = get_api_client()
        credentials = client.get("/api/credentials/")

        if output_format == "json":
            print_json(credentials)
        else:
            if not credentials:
                print_info("No credentials found")
                return
            
            rows = []
            for c in credentials:
                rows.append([
                    c.get("id", ""),
                    truncate_string(c.get("name", ""), 30),
                    c.get("credential_type", "N/A"),
                    "Owner" if c.get("can_delete") else "Shared",
                    format_datetime(c.get("created_at")),
                ])
            
            print_table(["ID", "Name", "Type", "Access", "Created"], rows)
            print_divider()
            print_info(f"Total: {len(credentials)} credentials")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to list credentials: {e.message}")
        raise click.Abort()


@credential.command("get")
@click.argument("credential_id", type=int)
@click.pass_context
def get_credential(ctx, credential_id: int):
    """
    Get credential details.

    \b
    Examples:
        rune credential get 1
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header(f"Credential Details (ID: {credential_id})")

    try:
        client = get_api_client()
        c = client.get(f"/api/credentials/{credential_id}")

        if output_format == "json":
            print_json(c)
        else:
            print_key_value("ID", c.get("id"))
            print_key_value("Name", c.get("name"))
            print_key_value("Type", c.get("credential_type"))
            print_key_value("Owner ID", c.get("owner_id"))
            print_key_value("Created", format_datetime(c.get("created_at")))
            print_key_value("Updated", format_datetime(c.get("updated_at")))
            
            print_divider()
            print_key_value("Can Edit", "Yes" if c.get("can_edit") else "No")
            print_key_value("Can Delete", "Yes" if c.get("can_delete") else "No")
            print_key_value("Can Share", "Yes" if c.get("can_share") else "No")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to get credential: {e.message}")
        raise click.Abort()


@credential.command("delete")
@click.argument("credential_id", type=int)
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
@click.pass_context
def delete_credential(ctx, credential_id: int, force: bool):
    """
    Delete a credential.

    \b
    Examples:
        rune credential delete 1
    """
    output_format = ctx.obj.get("output", "text")
    
    if not force and output_format == "text":
        if not confirm_action(f"Delete credential {credential_id}?"):
            print_info("Deletion cancelled")
            return

    try:
        client = get_api_client()
        client.delete(f"/api/credentials/{credential_id}")

        if output_format == "json":
            print_json({"success": True, "credential_id": credential_id})
        else:
            print_success(f"Credential {credential_id} deleted successfully")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to delete credential: {e.message}")
        raise click.Abort()

