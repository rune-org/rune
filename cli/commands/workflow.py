"""
Workflow Commands

Commands for managing workflows.
"""

import click

from cli.client import get_api_client, APIError
from cli.styles import (
    print_header,
    print_success,
    print_error,
    print_warning,
    print_info,
    print_divider,
    print_key_value,
    print_table,
    print_json,
    print_status_badge,
    confirm_action,
    console,
)
from cli.utils import format_datetime, truncate_string


@click.group()
def workflow():
    """
    Workflow management commands.

    \b
    Create, manage, and execute workflows.
    
    \b
    Quick Commands:
        rune workflow list          List all workflows
        rune workflow get ID        Get workflow details
        rune workflow run ID        Execute a workflow
        rune workflow create        Create a new workflow
    """
    pass


@workflow.command("list")
@click.option("--active-only", is_flag=True, help="Show only active workflows")
@click.pass_context
def list_workflows(ctx, active_only: bool):
    """
    List all workflows.

    \b
    Examples:
        rune workflow list
        rune workflow list --active-only
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Workflows")

    try:
        client = get_api_client()
        workflows = client.get("/api/workflows/")
        
        if active_only:
            workflows = [w for w in workflows if w.get("is_active")]

        if output_format == "json":
            print_json(workflows)
        else:
            if not workflows:
                print_info("No workflows found")
                return
            
            rows = []
            for wf in workflows:
                status = "Active" if wf.get("is_active") else "Inactive"
                rows.append([
                    wf.get("id", ""),
                    truncate_string(wf.get("name", ""), 30),
                    status,
                    wf.get("role", ""),
                    format_datetime(wf.get("updated_at")),
                ])
            
            print_table(["ID", "Name", "Status", "Role", "Updated"], rows)
            print_divider()
            print_info(f"Total: {len(workflows)} workflows")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to list workflows: {e.message}")
        raise click.Abort()


@workflow.command("get")
@click.argument("workflow_id", type=int)
@click.pass_context
def get_workflow(ctx, workflow_id: int):
    """
    Get workflow details.

    \b
    Examples:
        rune workflow get 1
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header(f"Workflow Details (ID: {workflow_id})")

    try:
        client = get_api_client()
        wf = client.get(f"/api/workflows/{workflow_id}")

        if output_format == "json":
            print_json(wf)
        else:
            print_key_value("ID", wf.get("id"))
            print_key_value("Name", wf.get("name"))
            print_key_value("Description", wf.get("description") or "N/A")
            
            status = "Active" if wf.get("is_active") else "Inactive"
            print_key_value("Status", status)
            
            print_key_value("Version", wf.get("version", 1))
            print_key_value("Role", wf.get("role", "N/A"))
            print_key_value("Created", format_datetime(wf.get("created_at")))
            print_key_value("Updated", format_datetime(wf.get("updated_at")))
            
            # Show node count if workflow data exists
            workflow_data = wf.get("workflow_data", {})
            if workflow_data:
                nodes = workflow_data.get("nodes", [])
                edges = workflow_data.get("edges", [])
                print_divider()
                print_key_value("Nodes", len(nodes))
                print_key_value("Connections", len(edges))

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to get workflow: {e.message}")
        raise click.Abort()


@workflow.command("run")
@click.argument("workflow_id", type=int)
@click.pass_context
def run_workflow(ctx, workflow_id: int):
    """
    Execute a workflow.

    \b
    Queues the workflow for execution and returns an execution ID.

    \b
    Examples:
        rune workflow run 1
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header(f"Execute Workflow (ID: {workflow_id})")

    try:
        client = get_api_client()
        response = client.post(f"/api/workflows/{workflow_id}/run")
        
        execution_id = response if isinstance(response, str) else response.get("execution_id")

        if output_format == "json":
            print_json({"success": True, "execution_id": execution_id})
        else:
            print_success("Workflow queued for execution!")
            print_divider()
            print_key_value("Workflow ID", workflow_id)
            print_key_value("Execution ID", execution_id)
            print_divider()
            print_info(f"Track progress: rune execution get {execution_id}")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to run workflow: {e.message}")
        raise click.Abort()


@workflow.command("create")
@click.option("--name", "-n", required=True, help="Workflow name")
@click.option("--description", "-d", default="", help="Workflow description")
@click.pass_context
def create_workflow(ctx, name: str, description: str):
    """
    Create a new workflow.

    \b
    Creates an empty workflow that can be edited in the web UI.

    \b
    Examples:
        rune workflow create -n "My Workflow"
        rune workflow create -n "My Workflow" -d "Description here"
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Create Workflow")

    try:
        client = get_api_client()
        response = client.post("/api/workflows/", data={
            "name": name,
            "description": description,
            "workflow_data": {"nodes": [], "edges": []},
        })

        if output_format == "json":
            print_json(response)
        else:
            print_success("Workflow created successfully!")
            print_divider()
            print_key_value("ID", response.get("id"))
            print_key_value("Name", response.get("name"))
            print_key_value("Description", response.get("description") or "N/A")
            print_divider()
            print_info("Edit this workflow in the web UI")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to create workflow: {e.message}")
        raise click.Abort()


@workflow.command("delete")
@click.argument("workflow_id", type=int)
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
@click.pass_context
def delete_workflow(ctx, workflow_id: int, force: bool):
    """
    Delete a workflow.

    \b
    Examples:
        rune workflow delete 1
        rune workflow delete 1 --force
    """
    output_format = ctx.obj.get("output", "text")
    
    if not force and output_format == "text":
        if not confirm_action(f"Delete workflow {workflow_id}? This cannot be undone."):
            print_info("Deletion cancelled")
            return

    try:
        client = get_api_client()
        client.delete(f"/api/workflows/{workflow_id}")

        if output_format == "json":
            print_json({"success": True, "workflow_id": workflow_id})
        else:
            print_success(f"Workflow {workflow_id} deleted successfully")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to delete workflow: {e.message}")
        raise click.Abort()


@workflow.command("activate")
@click.argument("workflow_id", type=int)
@click.pass_context
def activate_workflow(ctx, workflow_id: int):
    """
    Activate a workflow.

    \b
    Examples:
        rune workflow activate 1
    """
    output_format = ctx.obj.get("output", "text")

    try:
        client = get_api_client()
        response = client.put(f"/api/workflows/{workflow_id}/status", data={
            "is_active": True,
        })

        if output_format == "json":
            print_json(response)
        else:
            print_success(f"Workflow {workflow_id} activated")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to activate workflow: {e.message}")
        raise click.Abort()


@workflow.command("deactivate")
@click.argument("workflow_id", type=int)
@click.pass_context
def deactivate_workflow(ctx, workflow_id: int):
    """
    Deactivate a workflow.

    \b
    Examples:
        rune workflow deactivate 1
    """
    output_format = ctx.obj.get("output", "text")

    try:
        client = get_api_client()
        response = client.put(f"/api/workflows/{workflow_id}/status", data={
            "is_active": False,
        })

        if output_format == "json":
            print_json(response)
        else:
            print_success(f"Workflow {workflow_id} deactivated")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to deactivate workflow: {e.message}")
        raise click.Abort()
