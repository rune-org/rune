"""
Template Commands

Commands for managing workflow templates.
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
def template():
    """
    Template management commands.

    \b
    Create and manage workflow templates.
    """
    pass


@template.command("list")
@click.pass_context
def list_templates(ctx):
    """
    List all templates.

    \b
    Examples:
        rune template list
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Templates")

    try:
        client = get_api_client()
        templates = client.get("/api/templates/")

        if output_format == "json":
            print_json(templates)
        else:
            if not templates:
                print_info("No templates found")
                return
            
            rows = []
            for t in templates:
                rows.append([
                    t.get("id", ""),
                    truncate_string(t.get("name", ""), 30),
                    t.get("category", "N/A"),
                    "Yes" if t.get("is_public") else "No",
                    t.get("usage_count", 0),
                ])
            
            print_table(["ID", "Name", "Category", "Public", "Uses"], rows)
            print_divider()
            print_info(f"Total: {len(templates)} templates")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to list templates: {e.message}")
        raise click.Abort()


@template.command("get")
@click.argument("template_id", type=int)
@click.pass_context
def get_template(ctx, template_id: int):
    """
    Get template details.

    \b
    Examples:
        rune template get 1
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header(f"Template Details (ID: {template_id})")

    try:
        client = get_api_client()
        t = client.get(f"/api/templates/{template_id}")

        if output_format == "json":
            print_json(t)
        else:
            print_key_value("ID", t.get("id"))
            print_key_value("Name", t.get("name"))
            print_key_value("Description", t.get("description") or "N/A")
            print_key_value("Category", t.get("category") or "N/A")
            print_key_value("Public", "Yes" if t.get("is_public") else "No")
            print_key_value("Usage Count", t.get("usage_count", 0))
            print_key_value("Created", format_datetime(t.get("created_at")))

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to get template: {e.message}")
        raise click.Abort()


@template.command("use")
@click.argument("template_id", type=int)
@click.pass_context
def use_template(ctx, template_id: int):
    """
    Use a template to create a workflow.

    \b
    Examples:
        rune template use 1
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header(f"Use Template (ID: {template_id})")

    try:
        client = get_api_client()
        response = client.post(f"/api/templates/{template_id}/use")

        if output_format == "json":
            print_json(response)
        else:
            print_success("Template workflow data retrieved!")
            print_divider()
            print_info("Use this data to create a new workflow")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to use template: {e.message}")
        raise click.Abort()


@template.command("delete")
@click.argument("template_id", type=int)
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
@click.pass_context
def delete_template(ctx, template_id: int, force: bool):
    """
    Delete a template.

    \b
    Examples:
        rune template delete 1
    """
    output_format = ctx.obj.get("output", "text")
    
    if not force and output_format == "text":
        if not confirm_action(f"Delete template {template_id}?"):
            print_info("Deletion cancelled")
            return

    try:
        client = get_api_client()
        client.delete(f"/api/templates/{template_id}")

        if output_format == "json":
            print_json({"success": True, "template_id": template_id})
        else:
            print_success(f"Template {template_id} deleted successfully")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to delete template: {e.message}")
        raise click.Abort()

