"""
Admin Commands

Administrative commands for system management and user administration.
"""

import click

from rune_cli.client import get_api_client, APIError
from rune_cli.styles import (
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
    console,
)
from rune_cli.utils import format_datetime


@click.group()
def admin():
    """
    Administrative commands (admin only).

    \b
    System management, health checks, and statistics.
    Requires admin privileges.
    
    \b
    Quick Commands:
        rune admin health      Check API server health
        rune admin stats       View system statistics
        rune admin users       User management commands
    """
    pass


@admin.command("health")
@click.pass_context
def health(ctx):
    """
    Check API server health status.

    \b
    Examples:
        rune admin health
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("API Health Check")

    try:
        client = get_api_client()
        
        # Try to hit the auth endpoint to verify API is responding
        # The /health endpoint doesn't exist, so we check first-time-setup as a ping
        try:
            response = client.check_first_time_setup()
            api_reachable = True
        except Exception:
            api_reachable = False
        
        if output_format == "json":
            print_json({
                "status": "healthy" if api_reachable else "unhealthy",
                "reachable": api_reachable,
                "api_url": client.base_url,
            })
        else:
            if api_reachable:
                console.print(f"  Status: {print_status_badge('healthy')}")
                print_divider()
                print_key_value("API URL", client.base_url)
                print_key_value("Reachable", "Yes")
                print_divider()
                print_success("API server is healthy and responding!")
            else:
                console.print(f"  Status: {print_status_badge('unhealthy')}")
                print_divider()
                print_key_value("API URL", client.base_url)
                print_key_value("Reachable", "No")
                print_divider()
                print_error("Cannot reach API server")
                print_info("Make sure the API is running: docker compose up -d api")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message, "status_code": e.status_code})
        else:
            print_error(f"Health check failed: {e.message}")
            if "Failed to connect" in e.message:
                print_info("Make sure the API server is running:")
                print_info("  docker compose up -d api")
        raise click.Abort()


@admin.command("stats")
@click.pass_context
def stats(ctx):
    """
    Display system statistics and metrics.

    \b
    Examples:
        rune admin stats
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("System Statistics")

    try:
        client = get_api_client()
        
        # Collect stats from various endpoints
        stats_data = {}
        
        # Get users count
        try:
            users = client.get("/api/users/")
            stats_data["total_users"] = len(users) if isinstance(users, list) else 0
        except APIError:
            stats_data["total_users"] = "N/A"
        
        # Get workflows count
        try:
            workflows = client.get("/api/workflows/")
            stats_data["total_workflows"] = len(workflows) if isinstance(workflows, list) else 0
        except APIError:
            stats_data["total_workflows"] = "N/A"
        
        # Get templates count
        try:
            templates = client.get("/api/templates/")
            stats_data["total_templates"] = len(templates) if isinstance(templates, list) else 0
        except APIError:
            stats_data["total_templates"] = "N/A"
        
        # Get credentials count
        try:
            credentials = client.get("/api/credentials/")
            stats_data["total_credentials"] = len(credentials) if isinstance(credentials, list) else 0
        except APIError:
            stats_data["total_credentials"] = "N/A"

        if output_format == "json":
            print_json(stats_data)
        else:
            rows = [
                ["Total Users", stats_data.get("total_users", "N/A")],
                ["Total Workflows", stats_data.get("total_workflows", "N/A")],
                ["Total Templates", stats_data.get("total_templates", "N/A")],
                ["Total Credentials", stats_data.get("total_credentials", "N/A")],
            ]
            
            print_table(["Metric", "Count"], rows)

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to retrieve stats: {e.message}")
        raise click.Abort()


# User management subgroup
@admin.group("users")
def admin_users():
    """
    User management commands.

    \b
    Manage system users (admin only).
    """
    pass


@admin_users.command("list")
@click.pass_context
def list_users(ctx):
    """
    List all users in the system.

    \b
    Examples:
        rune admin users list
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("System Users")

    try:
        client = get_api_client()
        users = client.get("/api/users/")

        if output_format == "json":
            print_json(users)
        else:
            if not users:
                print_info("No users found")
                return
            
            rows = []
            for user in users:
                status = "Active" if user.get("is_active") else "Inactive"
                rows.append([
                    user.get("id", ""),
                    user.get("name", ""),
                    user.get("email", ""),
                    user.get("role", ""),
                    status,
                ])
            
            print_table(["ID", "Name", "Email", "Role", "Status"], rows)
            print_divider()
            print_info(f"Total: {len(users)} users")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to list users: {e.message}")
        raise click.Abort()


@admin_users.command("get")
@click.argument("user_id", type=int)
@click.pass_context
def get_user(ctx, user_id: int):
    """
    Get details of a specific user.

    \b
    Examples:
        rune admin users get 1
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header(f"User Details (ID: {user_id})")

    try:
        client = get_api_client()
        user = client.get(f"/api/users/{user_id}")

        if output_format == "json":
            print_json(user)
        else:
            print_key_value("ID", user.get("id"))
            print_key_value("Name", user.get("name"))
            print_key_value("Email", user.get("email"))
            print_key_value("Role", user.get("role"))
            print_key_value("Active", "Yes" if user.get("is_active") else "No")
            print_key_value("Created", format_datetime(user.get("created_at")))
            print_key_value("Last Login", format_datetime(user.get("last_login_at")))

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to get user: {e.message}")
        raise click.Abort()


@admin_users.command("create")
@click.option("--name", "-n", required=True, help="User name")
@click.option("--email", "-e", required=True, help="User email")
@click.option("--role", "-r", type=click.Choice(["user", "admin"]), default="user", help="User role")
@click.pass_context
def create_user(ctx, name: str, email: str, role: str):
    """
    Create a new user.

    \b
    A temporary password will be generated.

    \b
    Examples:
        rune admin users create -n "John Doe" -e john@example.com
        rune admin users create -n "Admin User" -e admin@example.com -r admin
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Create User")

    try:
        client = get_api_client()
        response = client.post("/api/users/", data={
            "name": name,
            "email": email,
            "role": role,
        })

        if output_format == "json":
            print_json(response)
        else:
            user = response.get("user", response)
            temp_password = response.get("temporary_password", "N/A")
            
            print_success("User created successfully!")
            print_divider()
            print_key_value("ID", user.get("id"))
            print_key_value("Name", user.get("name"))
            print_key_value("Email", user.get("email"))
            print_key_value("Role", user.get("role"))
            print_key_value("Temporary Password", temp_password)
            print_divider()
            print_warning("Share the temporary password securely!")
            print_info("User must change password on first login")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to create user: {e.message}")
        raise click.Abort()


@admin_users.command("delete")
@click.argument("user_id", type=int)
@click.option("--force", "-f", is_flag=True, help="Skip confirmation")
@click.pass_context
def delete_user(ctx, user_id: int, force: bool):
    """
    Delete a user.

    \b
    Examples:
        rune admin users delete 5
        rune admin users delete 5 --force
    """
    output_format = ctx.obj.get("output", "text")
    
    if not force and output_format == "text":
        if not click.confirm(f"Are you sure you want to delete user {user_id}?"):
            print_info("Deletion cancelled")
            return

    try:
        client = get_api_client()
        client.delete(f"/api/users/{user_id}")

        if output_format == "json":
            print_json({"success": True, "user_id": user_id})
        else:
            print_success(f"User {user_id} deleted successfully")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to delete user: {e.message}")
        raise click.Abort()


@admin_users.command("reset-password")
@click.argument("user_id", type=int)
@click.pass_context
def reset_password(ctx, user_id: int):
    """
    Reset a user's password.

    \b
    Generates a new temporary password for the user.

    \b
    Examples:
        rune admin users reset-password 5
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header(f"Reset Password (User ID: {user_id})")

    try:
        client = get_api_client()
        response = client.post(f"/api/users/{user_id}/reset-password")

        if output_format == "json":
            print_json(response)
        else:
            temp_password = response.get("temporary_password", "N/A")
            
            print_success("Password reset successfully!")
            print_divider()
            print_key_value("User ID", user_id)
            print_key_value("Temporary Password", temp_password)
            print_divider()
            print_warning("Share the temporary password securely!")
            print_info("User must change password on next login")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to reset password: {e.message}")
        raise click.Abort()

