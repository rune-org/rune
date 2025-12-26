"""
Rune CLI - Auth Commands

Commands for authentication and session management.
"""

import click
import asyncio
import json
from pathlib import Path
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..styles import (
    print_header,
    print_success,
    print_error,
    print_warning,
    print_info,
    print_step,
    print_divider,
    prompt_input,
    RUNE_PRIMARY,
)


def async_command(f):
    """Decorator to run async functions in click commands."""
    from functools import wraps

    @wraps(f)
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))

    return wrapper


# Token storage location
TOKEN_FILE = Path.home() / ".rune" / "credentials.json"


def save_token(token: str, email: str) -> None:
    """Save authentication token to file."""
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = {"token": token, "email": email}
    TOKEN_FILE.write_text(json.dumps(data))
    TOKEN_FILE.chmod(0o600)  # Secure file permissions


def load_token() -> dict | None:
    """Load authentication token from file."""
    if not TOKEN_FILE.exists():
        return None
    try:
        return json.loads(TOKEN_FILE.read_text())
    except (json.JSONDecodeError, IOError):
        return None


def clear_token() -> None:
    """Clear saved authentication token."""
    if TOKEN_FILE.exists():
        TOKEN_FILE.unlink()


@click.group()
def auth():
    """
    Authentication commands.

    \b
    Manage authentication, login sessions, and tokens.
    """
    pass


@auth.command("login")
@click.option("--email", "-e", help="User email address")
@click.option("--password", "-p", help="User password")
@click.option(
    "--save", "save_credentials", is_flag=True, help="Save token for future use"
)
@async_command
async def login(email: str, password: str, save_credentials: bool):
    """
    Login to Rune and optionally save credentials.

    \b
    Examples:
        rune auth login -e admin@example.com
        rune auth login -e admin@example.com --save
    """
    print_header("Rune Login")

    from src.db.config import get_async_engine, init_db
    from src.db.models import User
    from src.auth.security import verify_password, create_access_token

    # Prompt for credentials if not provided
    if not email:
        email = prompt_input("Email")
    if not password:
        password = prompt_input("Password", hide_input=True)

    print_step(1, 3, "Connecting to database...")
    await init_db()

    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        print_step(2, 3, "Authenticating...")

        statement = select(User).where(User.email == email)
        result = await session.exec(statement)
        user = result.first()

        if not user:
            print_error("Invalid email or password")
            return

        if not verify_password(password, user.hashed_password):
            print_error("Invalid email or password")
            return

        if not user.is_active:
            print_error("Account is deactivated")
            return

        print_step(3, 3, "Generating access token...")

        token = await create_access_token(user, session)

        click.echo()
        print_success("Login successful!")
        print_divider()
        print_info(f"User: {user.name} ({user.email})")
        print_info(f"Role: {user.role.value}")

        if user.must_change_password:
            print_warning("You must change your password!")

        if save_credentials:
            save_token(token, email)
            print_info("Token saved to ~/.rune/credentials.json")
        else:
            click.echo()
            click.echo(click.style("Access Token:", fg=RUNE_PRIMARY, bold=True))
            click.echo(token)

        print_divider()


@auth.command("logout")
def logout():
    """
    Logout and clear saved credentials.

    \b
    Examples:
        rune auth logout
    """
    print_header("Rune Logout")

    creds = load_token()
    if creds:
        clear_token()
        print_success(f"Logged out from {creds.get('email', 'unknown')}")
        print_info("Credentials cleared from ~/.rune/credentials.json")
    else:
        print_warning("No saved credentials found")


@auth.command("status")
@async_command
async def status():
    """
    Check current authentication status.

    \b
    Examples:
        rune auth status
    """
    print_header("Authentication Status")

    from src.auth.security import decode_access_token
    from src.core.exceptions import TokenExpiredError, InvalidTokenError

    creds = load_token()

    if not creds:
        print_warning("Not logged in")
        print_info("Run 'rune auth login --save' to authenticate")
        return

    try:
        user = decode_access_token(creds["token"])
        print_success("Authenticated")
        print_divider()
        print_info(f"User: {user.name}")
        print_info(f"Email: {user.email}")
        print_info(f"Role: {user.role}")
        print_divider()
    except TokenExpiredError:
        print_error("Token expired")
        print_info("Run 'rune auth login --save' to re-authenticate")
        clear_token()
    except InvalidTokenError:
        print_error("Invalid token")
        print_info("Run 'rune auth login --save' to re-authenticate")
        clear_token()


@auth.command("token")
@click.option("--decode", "-d", is_flag=True, help="Decode and display token contents")
def token(decode: bool):
    """
    Display or decode the current access token.

    \b
    Examples:
        rune auth token
        rune auth token --decode
    """
    print_header("Access Token")

    creds = load_token()

    if not creds:
        print_warning("No saved token found")
        print_info("Run 'rune auth login --save' to generate a token")
        return

    if decode:
        from src.auth.security import decode_access_token
        from src.core.exceptions import TokenExpiredError, InvalidTokenError

        try:
            user = decode_access_token(creds["token"])
            print_success("Token decoded successfully")
            print_divider()
            print_info(f"User ID: {user.id}")
            print_info(f"Name: {user.name}")
            print_info(f"Email: {user.email}")
            print_info(f"Role: {user.role}")
            print_info(f"Must Change Password: {user.must_change_password}")
            print_divider()
        except TokenExpiredError:
            print_error("Token has expired")
        except InvalidTokenError as e:
            print_error(f"Invalid token: {e}")
    else:
        click.echo(click.style("Token:", fg=RUNE_PRIMARY, bold=True))
        click.echo(creds["token"])


@auth.command("refresh")
@async_command
async def refresh():
    """
    Refresh the current access token.

    \b
    Examples:
        rune auth refresh
    """
    print_header("Refresh Token")

    from src.db.config import get_async_engine, init_db
    from src.db.models import User
    from src.auth.security import decode_access_token, create_access_token
    from src.core.exceptions import TokenExpiredError, InvalidTokenError

    creds = load_token()

    if not creds:
        print_error("No saved credentials found")
        print_info("Run 'rune auth login --save' first")
        return

    try:
        decode_access_token(creds["token"])
    except (TokenExpiredError, InvalidTokenError) as e:
        print_warning(f"Current token invalid: {e}")
        print_info("Attempting to refresh from database...")

    await init_db()
    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        statement = select(User).where(User.email == creds["email"])
        result = await session.exec(statement)
        user = result.first()

        if not user:
            print_error("User no longer exists")
            clear_token()
            return

        if not user.is_active:
            print_error("Account is deactivated")
            clear_token()
            return

        new_token = await create_access_token(user, session)
        save_token(new_token, user.email)

        print_success("Token refreshed successfully!")
        print_info("New token saved to ~/.rune/credentials.json")


@auth.command("change-password")
@click.option("--current", "-c", help="Current password")
@click.option("--new-password", "-n", help="New password")
@async_command
async def change_password(current: str, new_password: str):
    """
    Change password for the currently logged in user.

    \b
    Examples:
        rune auth change-password
    """
    print_header("Change Password")

    from src.db.config import get_async_engine, init_db
    from src.db.models import User
    from src.auth.security import (
        verify_password,
        hash_password,
        validate_password_strength,
        decode_access_token,
        create_access_token,
    )
    from src.core.exceptions import TokenExpiredError, InvalidTokenError

    creds = load_token()

    if not creds:
        print_error("Not logged in")
        print_info("Run 'rune auth login --save' first")
        return

    try:
        token_user = decode_access_token(creds["token"])
    except (TokenExpiredError, InvalidTokenError):
        print_error("Session expired. Please login again.")
        return

    # Prompt for passwords if not provided
    if not current:
        current = prompt_input("Current password", hide_input=True)
    if not new_password:
        new_password = prompt_input("New password", hide_input=True)
        confirm = prompt_input("Confirm new password", hide_input=True)
        if new_password != confirm:
            print_error("Passwords do not match!")
            return

    # Validate new password
    is_valid, error_msg = validate_password_strength(new_password)
    if not is_valid:
        print_error(f"Password validation failed: {error_msg}")
        return

    await init_db()
    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        statement = select(User).where(User.email == token_user.email)
        result = await session.exec(statement)
        user = result.first()

        if not user:
            print_error("User not found")
            return

        if not verify_password(current, user.hashed_password):
            print_error("Current password is incorrect")
            return

        user.hashed_password = hash_password(new_password)
        user.must_change_password = False
        session.add(user)
        await session.commit()

        # Generate new token
        new_token = await create_access_token(user, session)
        save_token(new_token, user.email)

        print_success("Password changed successfully!")
        print_info("New token saved")
