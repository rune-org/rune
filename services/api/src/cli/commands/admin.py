"""
Rune CLI - Admin Commands

Commands for managing users and administrative operations.
"""

import click
import asyncio
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..styles import (
    print_header,
    print_success,
    print_error,
    print_warning,
    print_info,
    print_step,
    print_table_header,
    print_table_row,
    print_divider,
    confirm_action,
    prompt_input,
    RUNE_SUCCESS,
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
def admin():
    """
    Admin commands for user and system management.

    \b
    Manage users, roles, and administrative operations.
    """
    pass


@admin.command("create-user")
@click.option("--email", "-e", required=True, help="User email address")
@click.option("--name", "-n", required=True, help="User display name")
@click.option("--password", "-p", help="User password (prompted if not provided)")
@click.option("--admin", "is_admin", is_flag=True, help="Create as admin user")
@click.option(
    "--force-password-change",
    is_flag=True,
    help="Require password change on first login",
)
@async_command
async def create_user(
    email: str, name: str, password: str, is_admin: bool, force_password_change: bool
):
    """
    Create a new user account.

    \b
    Examples:
        rune admin create-user -e admin@example.com -n "Admin User" --admin
        rune admin create-user -e user@example.com -n "Regular User"
    """
    print_header("Create New User")

    # Import here to avoid circular imports and ensure proper initialization
    from src.db.config import get_async_engine, init_db
    from src.db.models import User, UserRole
    from src.auth.security import hash_password, validate_password_strength

    # Prompt for password if not provided
    if not password:
        password = prompt_input("Enter password", hide_input=True)
        confirm_password = prompt_input("Confirm password", hide_input=True)
        if password != confirm_password:
            print_error("Passwords do not match!")
            return

    # Validate password strength
    is_valid, error_msg = validate_password_strength(password)
    if not is_valid:
        print_error(f"Password validation failed: {error_msg}")
        return

    print_step(1, 3, "Initializing database connection...")
    await init_db()

    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        print_step(2, 3, "Checking for existing user...")

        # Check if user already exists
        statement = select(User).where(User.email == email)
        result = await session.exec(statement)
        existing_user = result.first()

        if existing_user:
            print_error(
                f"User with email '{email}' already exists (ID: {existing_user.id})"
            )
            return

        print_step(3, 3, "Creating user...")

        # Create new user
        hashed = hash_password(password)
        new_user = User(
            email=email,
            name=name,
            hashed_password=hashed,
            role=UserRole.ADMIN if is_admin else UserRole.USER,
            must_change_password=force_password_change,
        )

        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)

        click.echo()
        print_success("User created successfully!")
        print_divider()
        print_info(f"ID: {new_user.id}")
        print_info(f"Name: {new_user.name}")
        print_info(f"Email: {new_user.email}")
        print_info(f"Role: {new_user.role.value}")
        print_info(f"Must Change Password: {new_user.must_change_password}")
        print_divider()


@admin.command("inject-admin")
@click.option("--email", "-e", default="admin@rune.io", help="Admin email address")
@click.option("--name", "-n", default="Rune Admin", help="Admin display name")
@click.option("--password", "-p", default="Admin@123!", help="Admin password")
@async_command
async def inject_admin(email: str, name: str, password: str):
    """
    Inject a default admin user into the system.

    \b
    Quick way to create an admin user with default or custom credentials.
    Default: admin@rune.io / Admin@123!

    \b
    Examples:
        rune admin inject-admin
        rune admin inject-admin -e superadmin@rune.io -p MySecurePass123!
    """
    print_header("Inject Admin User")

    from src.db.config import get_async_engine, init_db
    from src.db.models import User, UserRole
    from src.auth.security import hash_password

    print_step(1, 3, "Initializing database...")
    await init_db()

    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        print_step(2, 3, "Checking for existing admin...")

        statement = select(User).where(User.email == email)
        result = await session.exec(statement)
        existing_user = result.first()

        if existing_user:
            print_warning(f"User with email '{email}' already exists")
            if not confirm_action("Do you want to update this user to admin?"):
                print_info("Operation cancelled")
                return

            existing_user.role = UserRole.ADMIN
            existing_user.hashed_password = hash_password(password)
            existing_user.must_change_password = False
            session.add(existing_user)
            await session.commit()
            print_success(f"User '{email}' updated to admin!")
            return

        print_step(3, 3, "Creating admin user...")

        admin_user = User(
            email=email,
            name=name,
            hashed_password=hash_password(password),
            role=UserRole.ADMIN,
            must_change_password=False,
        )

        session.add(admin_user)
        await session.commit()
        await session.refresh(admin_user)

        click.echo()
        print_success("Admin user injected successfully!")
        print_divider()
        print_info(f"Email: {email}")
        print_info(f"Password: {password}")
        print_info("Role: ADMIN")
        print_divider()
        print_warning("Please change the password after first login!")


@admin.command("list-users")
@click.option(
    "--role",
    "-r",
    type=click.Choice(["admin", "user", "all"]),
    default="all",
    help="Filter by role",
)
@click.option("--limit", "-l", default=50, help="Maximum number of users to display")
@async_command
async def list_users(role: str, limit: int):
    """
    List all users in the system.

    \b
    Examples:
        rune admin list-users
        rune admin list-users --role admin
        rune admin list-users --limit 10
    """
    print_header("User List")

    from src.db.config import get_async_engine, init_db
    from src.db.models import User, UserRole

    await init_db()
    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        statement = select(User)

        if role == "admin":
            statement = statement.where(User.role == UserRole.ADMIN)
        elif role == "user":
            statement = statement.where(User.role == UserRole.USER)

        statement = statement.limit(limit)
        result = await session.exec(statement)
        users = result.all()

        if not users:
            print_warning("No users found")
            return

        # Print table
        widths = [8, 25, 30, 10, 10]
        print_table_header(["ID", "Name", "Email", "Role", "Active"], widths)

        for user in users:
            status_color = RUNE_SUCCESS if user.is_active else RUNE_ERROR
            print_table_row(
                [
                    str(user.id),
                    user.name[:23],
                    user.email[:28],
                    user.role.value,
                    "Yes" if user.is_active else "No",
                ],
                widths,
                highlight=status_color if not user.is_active else None,
            )

        print_divider()
        print_info(f"Total users displayed: {len(users)}")


@admin.command("delete-user")
@click.option("--email", "-e", help="User email to delete")
@click.option("--id", "user_id", type=int, help="User ID to delete")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation prompt")
@async_command
async def delete_user(email: str, user_id: int, force: bool):
    """
    Delete a user from the system.

    \b
    Examples:
        rune admin delete-user -e user@example.com
        rune admin delete-user --id 5 --force
    """
    if not email and not user_id:
        print_error("Please provide either --email or --id")
        return

    print_header("Delete User")

    from src.db.config import get_async_engine, init_db
    from src.db.models import User

    await init_db()
    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        if email:
            statement = select(User).where(User.email == email)
        else:
            statement = select(User).where(User.id == user_id)

        result = await session.exec(statement)
        user = result.first()

        if not user:
            print_error("User not found")
            return

        print_info(f"Found user: {user.name} ({user.email})")

        if not force:
            if not confirm_action(
                f"Are you sure you want to delete user '{user.email}'?"
            ):
                print_info("Operation cancelled")
                return

        await session.delete(user)
        await session.commit()

        print_success(f"User '{user.email}' deleted successfully")


@admin.command("update-role")
@click.option("--email", "-e", required=True, help="User email")
@click.option(
    "--role", "-r", type=click.Choice(["admin", "user"]), required=True, help="New role"
)
@async_command
async def update_role(email: str, role: str):
    """
    Update a user's role.

    \b
    Examples:
        rune admin update-role -e user@example.com -r admin
        rune admin update-role -e admin@example.com -r user
    """
    print_header("Update User Role")

    from src.db.config import get_async_engine, init_db
    from src.db.models import User, UserRole

    await init_db()
    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        statement = select(User).where(User.email == email)
        result = await session.exec(statement)
        user = result.first()

        if not user:
            print_error(f"User with email '{email}' not found")
            return

        old_role = user.role.value
        new_role = UserRole.ADMIN if role == "admin" else UserRole.USER

        if user.role == new_role:
            print_warning(f"User already has role '{role}'")
            return

        user.role = new_role
        session.add(user)
        await session.commit()

        print_success(f"User role updated: {old_role} → {role}")


@admin.command("reset-password")
@click.option("--email", "-e", required=True, help="User email")
@click.option("--password", "-p", help="New password (prompted if not provided)")
@click.option(
    "--force-change",
    is_flag=True,
    default=True,
    help="Require password change on next login",
)
@async_command
async def reset_password(email: str, password: str, force_change: bool):
    """
    Reset a user's password.

    \b
    Examples:
        rune admin reset-password -e user@example.com
        rune admin reset-password -e user@example.com -p NewPass123!
    """
    print_header("Reset User Password")

    from src.db.config import get_async_engine, init_db
    from src.db.models import User
    from src.auth.security import hash_password, validate_password_strength

    if not password:
        password = prompt_input("Enter new password", hide_input=True)
        confirm_password = prompt_input("Confirm password", hide_input=True)
        if password != confirm_password:
            print_error("Passwords do not match!")
            return

    is_valid, error_msg = validate_password_strength(password)
    if not is_valid:
        print_error(f"Password validation failed: {error_msg}")
        return

    await init_db()
    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        statement = select(User).where(User.email == email)
        result = await session.exec(statement)
        user = result.first()

        if not user:
            print_error(f"User with email '{email}' not found")
            return

        user.hashed_password = hash_password(password)
        user.must_change_password = force_change
        session.add(user)
        await session.commit()

        print_success(f"Password reset for user '{email}'")
        if force_change:
            print_info("User will be required to change password on next login")
