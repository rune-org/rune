"""
Database Commands

Direct database operations via Docker for maintenance and management.
"""

import click
from datetime import datetime

from rune_cli.core import get_database_manager, get_docker_client, get_config
from rune_cli.styles import (
    console,
    print_header,
    print_success,
    print_error,
    print_warning,
    print_info,
    print_step,
    print_divider,
    print_key_value,
    print_table,
    print_json,
    print_panel,
    print_status_badge,
    create_progress,
    confirm_action,
)


@click.group()
def db():
    """
    Database management commands.

    \b
    Direct database operations via Docker containers.
    Requires Docker to be installed and the database container running.
    
    \b
    Quick Commands:
        rune db health         Check database connection
        rune db reset          Reset database to clean state
        rune db info           Show database information
        rune db tables         List all tables with stats
    """
    pass


@db.command("health")
@click.pass_context
def health(ctx):
    """
    Check database connection health.

    \b
    Verifies Docker availability, container status, and database connectivity.

    \b
    Examples:
        rune db health
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Database Health Check")
    
    docker = get_docker_client()
    db_manager = get_database_manager(docker)
    
    results = {
        "docker_available": False,
        "container_running": False,
        "database_connected": False,
        "container_name": docker.container_name,
        "status": "unhealthy",
    }
    
    # Check Docker
    if output_format == "text":
        print_step(1, 3, "Checking Docker availability...")
    
    results["docker_available"] = docker.is_docker_available()
    
    if not results["docker_available"]:
        if output_format == "json":
            print_json(results)
        else:
            print_error("Docker is not available")
            print_info("Make sure Docker is installed and running")
        return
    
    # Check container
    if output_format == "text":
        print_step(2, 3, f"Checking container '{docker.container_name}'...")
    
    results["container_running"] = docker.is_container_running()
    
    if not results["container_running"]:
        if output_format == "json":
            print_json(results)
        else:
            print_error(f"Container '{docker.container_name}' is not running")
            print_info("Start the container with: docker compose up -d")
            
            # Try to find database container
            found = docker.find_database_container()
            if found:
                print_info(f"Found database container: {found}")
                print_info(f"Update config with: rune config set docker_container {found}")
        return
    
    # Check database connection
    if output_format == "text":
        print_step(3, 3, "Testing database connection...")
    
    connected, msg = db_manager.check_connection()
    results["database_connected"] = connected
    results["connection_message"] = msg
    
    if connected:
        results["status"] = "healthy"
    
    if output_format == "json":
        print_json(results)
    else:
        console.print()
        if results["docker_available"]:
            console.print(f"  Docker:     {print_status_badge('connected')}")
        else:
            console.print(f"  Docker:     {print_status_badge('disconnected')}")
        
        if results["container_running"]:
            console.print(f"  Container:  {print_status_badge('active')}")
        else:
            console.print(f"  Container:  {print_status_badge('inactive')}")
        
        if results["database_connected"]:
            console.print(f"  Database:   {print_status_badge('healthy')}")
        else:
            console.print(f"  Database:   {print_status_badge('unhealthy')}")
        
        print_divider()
        
        if connected:
            print_success("Database is healthy and ready!")
        else:
            print_error(f"Database connection failed: {msg}")


@db.command("info")
@click.pass_context
def info(ctx):
    """
    Display database information.

    \b
    Shows database version, size, and configuration.

    \b
    Examples:
        rune db info
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Database Information")
    
    db_manager = get_database_manager()
    info_data = db_manager.get_database_info()
    
    if output_format == "json":
        print_json(info_data)
    else:
        if not info_data.get("connected"):
            print_error("Cannot connect to database")
            print_info("Run 'rune db health' to diagnose")
            return
        
        print_key_value("Database", info_data.get("database", "N/A"))
        print_key_value("Container", info_data.get("container", "N/A"))
        print_key_value("Version", info_data.get("version", "N/A"))
        print_key_value("Size", info_data.get("size", "N/A"))
        print_key_value("Tables", str(len(info_data.get("tables", []))))
        print_divider()
        
        if info_data.get("tables"):
            console.print("\n[primary]Tables:[/primary]")
            for table in info_data["tables"]:
                console.print(f"  • {table}")


@db.command("tables")
@click.pass_context
def tables(ctx):
    """
    List all database tables with statistics.

    \b
    Examples:
        rune db tables
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Database Tables")
    
    db_manager = get_database_manager()
    stats = db_manager.get_table_stats()
    
    if output_format == "json":
        print_json(stats)
    else:
        if not stats:
            connected, msg = db_manager.check_connection()
            if not connected:
                print_error(f"Cannot connect to database: {msg}")
            else:
                print_info("No tables found in database")
            return
        
        rows = [[s["table"], s["rows"], s["size"]] for s in stats]
        print_table(["Table Name", "Rows", "Size"], rows)


@db.command("reset")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation prompt")
@click.option("--keep-admin", is_flag=True, help="Preserve admin user after reset")
@click.pass_context
def reset(ctx, force: bool, keep_admin: bool):
    """
    Reset database to clean state.

    \b
    ⚠️  WARNING: This will DELETE ALL DATA!
    
    This operation will:
    • Truncate all data tables
    • Reset auto-increment sequences
    • Optionally recreate admin user

    \b
    Examples:
        rune db reset              # Interactive confirmation
        rune db reset --force      # Skip confirmation
        rune db reset --keep-admin # Preserve admin user
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Database Reset", "⚠️  DESTRUCTIVE OPERATION")
    
    db_manager = get_database_manager()
    
    # Check connection first
    connected, msg = db_manager.check_connection()
    if not connected:
        if output_format == "json":
            print_json({"success": False, "error": msg})
        else:
            print_error(f"Cannot connect to database: {msg}")
            print_info("Run 'rune db health' to diagnose")
        raise click.Abort()
    
    # Get current stats for confirmation
    if output_format == "text" and not force:
        stats = db_manager.get_table_stats()
        
        print_warning("This will DELETE ALL DATA from the following tables:")
        console.print()
        
        if stats:
            rows = [[s["table"], s["rows"]] for s in stats if s["table"] != "alembic_version"]
            print_table(["Table", "Rows to Delete"], rows)
            console.print()
        
        if not confirm_action("Are you absolutely sure you want to reset the database?"):
            print_info("Database reset cancelled")
            return
        
        # Double confirmation for safety
        if not confirm_action("This action CANNOT be undone. Continue?"):
            print_info("Database reset cancelled")
            return
    
    # Perform reset
    if output_format == "text":
        with create_progress() as progress:
            task = progress.add_task("Resetting database...", total=100)
            
            progress.update(task, advance=30, description="Truncating tables...")
            success, result = db_manager.reset_database()
            
            if success and keep_admin:
                progress.update(task, advance=40, description="Creating admin user...")
                db_manager.seed_admin_user()
            
            progress.update(task, advance=30, description="Finalizing...")
    else:
        success, result = db_manager.reset_database()
        if success and keep_admin:
            db_manager.seed_admin_user()
    
    result["timestamp"] = datetime.now().isoformat()
    
    if output_format == "json":
        print_json(result)
    else:
        console.print()
        if success:
            print_success("Database reset completed successfully!")
            print_divider()
            print_key_value("Tables cleared", str(len(result.get("tables_cleared", []))))
            print_key_value("Timestamp", result["timestamp"])
            
            if keep_admin:
                print_info("Admin user preserved/recreated")
            else:
                print_info("Run 'rune auth signup' to create a new admin user")
        else:
            print_error("Database reset failed!")
            for error in result.get("errors", []):
                print_error(f"  • {error}")


@db.command("sql")
@click.argument("query")
@click.pass_context
def sql(ctx, query: str):
    """
    Execute raw SQL query.

    \b
    ⚠️  Use with caution! This executes SQL directly on the database.

    \b
    Examples:
        rune db sql "SELECT COUNT(*) FROM users"
        rune db sql "SELECT * FROM workflows LIMIT 5"
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("SQL Execution")
    
    db_manager = get_database_manager()
    
    # Check connection
    connected, msg = db_manager.check_connection()
    if not connected:
        print_error(f"Cannot connect to database: {msg}")
        raise click.Abort()
    
    # Warn about dangerous queries
    dangerous_keywords = ["DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE"]
    query_upper = query.upper()
    
    if any(kw in query_upper for kw in dangerous_keywords):
        if output_format == "text":
            print_warning("This query may modify data!")
            if not confirm_action("Continue with this query?"):
                print_info("Query cancelled")
                return
    
    # Execute query
    success, stdout, stderr = db_manager.execute_sql(query)
    
    if output_format == "json":
        print_json({
            "success": success,
            "query": query,
            "output": stdout,
            "error": stderr if not success else None,
        })
    else:
        if success:
            print_success("Query executed successfully")
            if stdout:
                print_divider()
                console.print(stdout)
        else:
            print_error("Query failed")
            if stderr:
                print_error(stderr)


@db.command("seed")
@click.option("--admin-email", default="admin@rune.io", help="Admin email address")
@click.option("--admin-name", default="Admin", help="Admin name")
@click.pass_context
def seed(ctx, admin_email: str, admin_name: str):
    """
    Seed database with initial admin user.

    \b
    Creates an admin user if none exists.
    Default password is 'admin123' (must be changed on first login).

    \b
    Examples:
        rune db seed
        rune db seed --admin-email admin@example.com
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Database Seeding")
    
    db_manager = get_database_manager()
    
    # Check connection
    connected, msg = db_manager.check_connection()
    if not connected:
        print_error(f"Cannot connect to database: {msg}")
        raise click.Abort()
    
    if output_format == "text":
        print_step(1, 1, "Creating admin user...")
    
    success, msg = db_manager.seed_admin_user(
        name=admin_name,
        email=admin_email,
    )
    
    if output_format == "json":
        print_json({
            "success": success,
            "message": msg,
            "admin_email": admin_email,
        })
    else:
        console.print()
        if success:
            print_success("Admin user created!")
            print_divider()
            print_key_value("Email", admin_email)
            print_key_value("Name", admin_name)
            print_key_value("Password", "admin123 (change on first login)")
        else:
            print_warning(msg)

