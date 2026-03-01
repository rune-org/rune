"""
Execution Commands

Commands for viewing workflow executions.
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
    print_status_badge,
    console,
)
from rune_cli.utils import format_datetime


@click.group()
def execution():
    """
    Execution management commands.

    \b
    View and manage workflow executions.
    """
    pass


@execution.command("list")
@click.argument("workflow_id", type=int)
@click.pass_context
def list_executions(ctx, workflow_id: int):
    """
    List executions for a workflow.

    \b
    Examples:
        rune execution list 1
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header(f"Executions for Workflow {workflow_id}")

    try:
        client = get_api_client()
        # Request execution access token
        client.get(f"/api/workflows/{workflow_id}/executions")
        
        if output_format == "json":
            print_json({"workflow_id": workflow_id, "message": "Execution access granted"})
        else:
            print_success("Execution access granted")
            print_info("View executions in the web UI for real-time updates")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to access executions: {e.message}")
        raise click.Abort()


@execution.command("get")
@click.argument("workflow_id", type=int)
@click.argument("execution_id")
@click.pass_context
def get_execution(ctx, workflow_id: int, execution_id: str):
    """
    Get execution details.

    \b
    Examples:
        rune execution get 1 abc-123
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header(f"Execution Details")

    try:
        client = get_api_client()
        # Request execution access
        client.get(f"/api/workflows/{workflow_id}/executions/{execution_id}")
        
        if output_format == "json":
            print_json({
                "workflow_id": workflow_id,
                "execution_id": execution_id,
                "message": "Execution access granted"
            })
        else:
            print_key_value("Workflow ID", workflow_id)
            print_key_value("Execution ID", execution_id)
            print_divider()
            print_success("Execution access granted")
            print_info("View execution details in the web UI for real-time updates")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to access execution: {e.message}")
        raise click.Abort()

