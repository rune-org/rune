"""
Rune CLI - Database Commands

Commands for database management and maintenance.
"""

import click
import asyncio
from datetime import datetime

from ..styles import (
    print_header,
    print_success,
    print_error,
    print_warning,
    print_info,
    print_step,
    print_divider,
    confirm_action,
    RUNE_ERROR,
)


def async_command(f):
    """Decorator to run async functions in click commands."""
    from functools import wraps

    @wraps(f)
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@click.group()
def db():
    """
    Database management commands.

    \b
    Manage database migrations, seeding, and maintenance operations.
    """
    pass


@db.command("init")
@async_command
async def init_database():
    """
    Initialize the database schema.

    \b
    Creates all tables defined in the models.

    \b
    Examples:
        rune db init
    """
    print_header("Initialize Database")

    from src.db.config import init_db

    print_step(1, 2, "Connecting to database...")
    print_step(2, 2, "Creating tables...")

    try:
        await init_db()
        print_success("Database initialized successfully!")
    except Exception as e:
        print_error(f"Failed to initialize database: {e}")


@db.command("reset")
@click.option("--confirm", "confirmed", is_flag=True, help="Skip confirmation prompt")
@click.option("--seed", is_flag=True, help="Seed with default data after reset")
@async_command
async def reset_database(confirmed: bool, seed: bool):
    """
    Reset the database (DROP ALL TABLES and recreate).

    \b
    WARNING: This will delete ALL data in the database!

    \b
    Examples:
        rune db reset
        rune db reset --confirm --seed
    """
    print_header("Reset Database")

    click.echo(
        click.style("⚠️  WARNING: This will DELETE ALL DATA!", fg=RUNE_ERROR, bold=True)
    )
    click.echo()

    if not confirmed:
        if not confirm_action(
            "Are you absolutely sure you want to reset the database?"
        ):
            print_info("Operation cancelled")
            return

        # Double confirmation for safety
        confirm_text = click.prompt(
            click.style("Type 'RESET' to confirm", fg=RUNE_ERROR)
        )
        if confirm_text != "RESET":
            print_info("Operation cancelled")
            return

    from sqlmodel import SQLModel
    from src.db.config import get_async_engine, init_db

    print_step(1, 3, "Connecting to database...")
    engine = get_async_engine()

    print_step(2, 3, "Dropping all tables...")

    # Import models to ensure they're registered
    import src.db.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)

    print_step(3, 3, "Recreating tables...")
    await init_db()

    print_success("Database reset successfully!")

    if seed:
        click.echo()
        await seed_database_impl()


@db.command("seed")
@click.option("--admin-email", default="admin@rune.io", help="Admin email for seeding")
@click.option(
    "--admin-password", default="Admin@123!", help="Admin password for seeding"
)
@async_command
async def seed_database(admin_email: str, admin_password: str):
    """
    Seed the database with initial data.

    \b
    Creates a default admin user and sample data.

    \b
    Examples:
        rune db seed
        rune db seed --admin-email admin@mycompany.com
    """
    await seed_database_impl(admin_email, admin_password)


async def seed_database_impl(
    admin_email: str = "admin@rune.io", admin_password: str = "Admin@123!"
):
    """Implementation of database seeding."""
    print_header("Seed Database")

    from sqlmodel import select
    from sqlmodel.ext.asyncio.session import AsyncSession
    from src.db.config import get_async_engine, init_db
    from src.db.models import User, UserRole, WorkflowTemplate
    from src.auth.security import hash_password

    print_step(1, 4, "Initializing database...")
    await init_db()

    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        print_step(2, 4, "Creating admin user...")

        # Check if admin exists
        statement = select(User).where(User.email == admin_email)
        result = await session.exec(statement)
        existing_admin = result.first()

        if existing_admin:
            print_warning(f"Admin user '{admin_email}' already exists")
        else:
            admin_user = User(
                email=admin_email,
                name="Rune Admin",
                hashed_password=hash_password(admin_password),
                role=UserRole.ADMIN,
                must_change_password=False,
            )
            session.add(admin_user)
            await session.commit()
            print_info(f"Created admin: {admin_email}")

        print_step(3, 4, "Creating sample templates...")

        # Check for existing templates
        statement = select(WorkflowTemplate)
        result = await session.exec(statement)
        existing_templates = result.all()

        if existing_templates:
            print_warning("Templates already exist, skipping...")
        else:
            templates = [
                WorkflowTemplate(
                    name="HTTP Webhook",
                    description="A simple HTTP webhook workflow template",
                    category="integration",
                    is_public=True,
                    workflow_data={
                        "nodes": [
                            {
                                "id": "1",
                                "type": "http_trigger",
                                "name": "Webhook Trigger",
                            },
                            {
                                "id": "2",
                                "type": "http_request",
                                "name": "Forward Request",
                            },
                        ],
                        "edges": [{"from": "1", "to": "2"}],
                    },
                ),
                WorkflowTemplate(
                    name="Scheduled Task",
                    description="A cron-based scheduled task workflow",
                    category="automation",
                    is_public=True,
                    workflow_data={
                        "nodes": [
                            {"id": "1", "type": "cron_trigger", "name": "Schedule"},
                            {"id": "2", "type": "script", "name": "Execute Task"},
                        ],
                        "edges": [{"from": "1", "to": "2"}],
                    },
                ),
                WorkflowTemplate(
                    name="Email Notification",
                    description="Send email notifications based on triggers",
                    category="notification",
                    is_public=True,
                    workflow_data={
                        "nodes": [
                            {"id": "1", "type": "trigger", "name": "Event Trigger"},
                            {"id": "2", "type": "email", "name": "Send Email"},
                        ],
                        "edges": [{"from": "1", "to": "2"}],
                    },
                ),
            ]

            for template in templates:
                session.add(template)

            await session.commit()
            print_info(f"Created {len(templates)} sample templates")

        print_step(4, 4, "Finalizing...")

    print_success("Database seeded successfully!")
    print_divider()
    print_info(f"Admin Email: {admin_email}")
    print_info(f"Admin Password: {admin_password}")
    print_divider()


@db.command("status")
@async_command
async def db_status():
    """
    Check database connection and status.

    \b
    Examples:
        rune db status
    """
    print_header("Database Status")

    from sqlmodel import text
    from sqlmodel.ext.asyncio.session import AsyncSession
    from src.db.config import get_async_engine
    from src.core.config import get_settings

    settings = get_settings()

    print_info(f"Host: {settings.postgres_host}")
    print_info(f"Port: {settings.postgres_port}")
    print_info(f"Database: {settings.postgres_db}")
    print_info(f"User: {settings.postgres_user}")
    print_divider()

    try:
        engine = get_async_engine()

        async with AsyncSession(engine) as session:
            # Test connection
            result = await session.exec(text("SELECT version()"))
            version = result.first()

            # Get table count
            result = await session.exec(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
                )
            )
            table_count = result.first()

            # Get database size
            result = await session.exec(
                text(
                    f"SELECT pg_size_pretty(pg_database_size('{settings.postgres_db}'))"
                )
            )
            db_size = result.first()

        print_success("Connection successful!")
        print_divider()
        print_info(f"PostgreSQL Version: {version[0][:50]}...")
        print_info(f"Tables: {table_count[0]}")
        print_info(f"Database Size: {db_size[0]}")

    except Exception as e:
        print_error(f"Connection failed: {e}")


@db.command("migrate")
@click.option(
    "--revision", "-r", default="head", help="Target revision (default: head)"
)
@click.pass_context
def migrate(ctx, revision: str):
    """
    Run database migrations using Alembic.

    \b
    Examples:
        rune db migrate
        rune db migrate -r +1
        rune db migrate -r abc123
    """
    print_header("Run Migrations")

    import subprocess
    import os

    # Get the API service directory
    api_dir = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )

    try:
        print_step(1, 2, f"Running migrations to {revision}...")

        result = subprocess.run(
            ["alembic", "upgrade", revision],
            cwd=api_dir,
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            print_step(2, 2, "Migrations complete")
            print_success("Database migrated successfully!")
            if result.stdout:
                click.echo(result.stdout)
        else:
            print_error("Migration failed!")
            if result.stderr:
                click.echo(result.stderr)

    except FileNotFoundError:
        print_warning("Alembic not found. Using direct schema initialization instead.")
        print_info("Run 'rune db init' to initialize the database")


@db.command("backup")
@click.option("--output", "-o", default=None, help="Output file path")
@click.option(
    "--format",
    "fmt",
    type=click.Choice(["sql", "custom"]),
    default="sql",
    help="Backup format",
)
def backup_database(output: str, fmt: str):
    """
    Create a database backup.

    \b
    Examples:
        rune db backup
        rune db backup -o backup.sql
        rune db backup --format custom -o backup.dump
    """
    print_header("Database Backup")

    import subprocess
    from src.core.config import get_settings

    settings = get_settings()

    if not output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = "dump" if fmt == "custom" else "sql"
        output = f"rune_backup_{timestamp}.{ext}"

    print_step(1, 2, "Creating backup...")

    cmd = [
        "pg_dump",
        "-h",
        settings.postgres_host,
        "-p",
        str(settings.postgres_port),
        "-U",
        settings.postgres_user,
        "-d",
        settings.postgres_db,
        "-f",
        output,
    ]

    if fmt == "custom":
        cmd.extend(["-F", "c"])

    try:
        env = {"PGPASSWORD": settings.postgres_password}
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env={**dict(__import__("os").environ), **env},
        )

        if result.returncode == 0:
            print_step(2, 2, "Backup complete")
            print_success(f"Backup saved to: {output}")
        else:
            print_error("Backup failed!")
            if result.stderr:
                click.echo(result.stderr)
    except FileNotFoundError:
        print_error(
            "pg_dump not found. Make sure PostgreSQL client tools are installed."
        )


@db.command("stats")
@async_command
async def db_stats():
    """
    Show database statistics.

    \b
    Examples:
        rune db stats
    """
    print_header("Database Statistics")

    from sqlmodel import select, func
    from sqlmodel.ext.asyncio.session import AsyncSession
    from src.db.config import get_async_engine, init_db
    from src.db.models import User, Workflow, WorkflowTemplate, WorkflowCredential

    await init_db()
    engine = get_async_engine()

    async with AsyncSession(engine) as session:
        # Count records in each table
        user_count = await session.exec(select(func.count()).select_from(User))
        workflow_count = await session.exec(select(func.count()).select_from(Workflow))
        template_count = await session.exec(
            select(func.count()).select_from(WorkflowTemplate)
        )
        credential_count = await session.exec(
            select(func.count()).select_from(WorkflowCredential)
        )

        print_info(f"Users: {user_count.first()}")
        print_info(f"Workflows: {workflow_count.first()}")
        print_info(f"Templates: {template_count.first()}")
        print_info(f"Credentials: {credential_count.first()}")

        print_divider()

        # Get admin/user breakdown
        from src.db.models import UserRole

        admin_count = await session.exec(
            select(func.count()).select_from(User).where(User.role == UserRole.ADMIN)
        )
        print_info(f"Admin Users: {admin_count.first()}")

        active_count = await session.exec(
            select(func.count()).select_from(User).where(User.is_active.is_(True))
        )
        print_info(f"Active Users: {active_count.first()}")

        # Active workflows
        active_workflows = await session.exec(
            select(func.count())
            .select_from(Workflow)
            .where(Workflow.is_active.is_(True))
        )
        print_info(f"Active Workflows: {active_workflows.first()}")


@db.command("truncate")
@click.option("--table", "-t", required=True, help="Table name to truncate")
@click.option("--confirm", "confirmed", is_flag=True, help="Skip confirmation prompt")
@async_command
async def truncate_table(table: str, confirmed: bool):
    """
    Truncate a specific table.

    \b
    WARNING: This will delete all data in the specified table!

    \b
    Examples:
        rune db truncate -t workflows --confirm
    """
    print_header(f"Truncate Table: {table}")

    valid_tables = [
        "users",
        "workflows",
        "workflow_users",
        "workflow_templates",
        "workflow_credentials",
        "workflow_credential_links",
        "credential_shares",
    ]

    if table not in valid_tables:
        print_error(f"Invalid table name: {table}")
        print_info(f"Valid tables: {', '.join(valid_tables)}")
        return

    if not confirmed:
        if not confirm_action(f"Are you sure you want to truncate '{table}'?"):
            print_info("Operation cancelled")
            return

    from sqlmodel import text
    from sqlmodel.ext.asyncio.session import AsyncSession
    from src.db.config import get_async_engine, init_db

    await init_db()
    engine = get_async_engine()

    async with AsyncSession(engine) as session:
        await session.exec(text(f"TRUNCATE TABLE {table} CASCADE"))
        await session.commit()

    print_success(f"Table '{table}' truncated successfully!")
