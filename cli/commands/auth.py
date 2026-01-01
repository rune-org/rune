"""
Authentication Commands

Commands for user authentication and session management.
"""

import click
from datetime import datetime

from cli.auth import get_token_manager
from cli.client import get_api_client, APIError, AuthenticationError
from cli.styles import (
    print_header,
    print_success,
    print_error,
    print_warning,
    print_info,
    print_step,
    print_divider,
    print_key_value,
    print_json,
    print_status_badge,
    prompt_input,
    confirm_action,
    console,
)
from cli.utils import validate_email, validate_password, format_datetime


@click.group()
def auth():
    """
    Authentication commands.

    \b
    Manage authentication, login sessions, and tokens.
    
    \b
    Quick Commands:
        rune auth login          Login to your account
        rune auth logout         Logout and clear tokens
        rune auth status         Check authentication status
        rune auth signup         Create first admin account
    """
    pass


@auth.command("login")
@click.option("--email", "-e", help="User email address")
@click.option("--password", "-p", help="User password (not recommended, use prompt)")
@click.pass_context
def login(ctx, email: str, password: str):
    """
    Login to Rune and save authentication token.

    \b
    Authenticates with the API server and stores the JWT token
    for subsequent requests.

    \b
    Examples:
        rune auth login
        rune auth login -e admin@example.com
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Rune Login")

    # Prompt for email if not provided
    if not email:
        email = prompt_input("Email")
    
    # Validate email
    is_valid, error = validate_email(email)
    if not is_valid:
        print_error(error)
        raise click.Abort()
    
    # Prompt for password if not provided
    if not password:
        password = prompt_input("Password", hide_input=True)

    if output_format == "text":
        print_step(1, 2, "Authenticating...")

    try:
        client = get_api_client()
        response = client.login(email, password)
        
        access_token = response.get("access_token")
        refresh_token = response.get("refresh_token")
        
        if not access_token:
            print_error("No access token received from server")
            raise click.Abort()

        if output_format == "text":
            print_step(2, 2, "Saving credentials...")

        # Save token
        token_manager = get_token_manager()
        token_manager.save_token(access_token, email, refresh_token)

        if output_format == "json":
            print_json({
                "success": True,
                "email": email,
                "token_saved": True,
            })
        else:
            console.print()
            print_success("Login successful!")
            print_divider()
            print_key_value("Email", email)
            print_info("Token saved to ~/.rune/credentials.json")
            print_divider()
            print_info("You can now use authenticated commands")

    except AuthenticationError as e:
        if output_format == "json":
            print_json({"success": False, "error": e.message})
        else:
            print_error(f"Login failed: {e.message}")
            print_info("Check your email and password")
        raise click.Abort()
    except APIError as e:
        if output_format == "json":
            print_json({"success": False, "error": e.message})
        else:
            print_error(f"Login failed: {e.message}")
        raise click.Abort()


@auth.command("logout")
@click.pass_context
def logout(ctx):
    """
    Logout and clear stored credentials.

    \b
    Revokes the current session and removes stored tokens.

    \b
    Examples:
        rune auth logout
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Rune Logout")
    
    token_manager = get_token_manager()
    
    # Check if logged in
    if not token_manager.is_authenticated():
        if output_format == "json":
            print_json({"success": True, "message": "Not logged in"})
        else:
            print_info("Not currently logged in")
        return
    
    # Try to logout from server
    try:
        client = get_api_client()
        client.logout()
    except APIError:
        pass  # Ignore server errors, still clear local token
    
    # Clear local token
    token_manager.clear_token()
    
    if output_format == "json":
        print_json({"success": True, "message": "Logged out successfully"})
    else:
        print_success("Logged out successfully")
        print_info("Local credentials cleared")


@auth.command("status")
@click.pass_context
def status(ctx):
    """
    Check current authentication status.

    \b
    Shows token information and expiration status.

    \b
    Examples:
        rune auth status
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Authentication Status")
    
    token_manager = get_token_manager()
    info = token_manager.get_token_info()
    
    if output_format == "json":
        print_json(info)
    else:
        if info.get("authenticated"):
            if info.get("is_expired"):
                console.print(f"  Status: {print_status_badge('failed')}")
            else:
                console.print(f"  Status: {print_status_badge('success')}")
            
            print_divider()
            print_key_value("Email", info.get("email", "N/A"))
            print_key_value("User ID", info.get("user_id", "N/A"))
            print_key_value("Role", info.get("role", "N/A"))
            print_key_value("Saved At", format_datetime(info.get("saved_at")))
            print_key_value("Expires At", format_datetime(info.get("expires_at")))
            
            if info.get("is_expired"):
                print_divider()
                print_warning("Token has expired! Please login again.")
        else:
            console.print(f"  Status: [muted]NOT AUTHENTICATED[/muted]")
            print_divider()
            print_info("Login with: rune auth login")


@auth.command("signup")
@click.option("--name", "-n", help="Admin name")
@click.option("--email", "-e", help="Admin email address")
@click.option("--password", "-p", help="Admin password (not recommended, use prompt)")
@click.pass_context
def signup(ctx, name: str, email: str, password: str):
    """
    Create first admin account (first-time setup only).

    \b
    This command only works when no users exist in the system.
    Creates the initial admin account.

    \b
    Examples:
        rune auth signup
        rune auth signup -n "Admin User" -e admin@example.com
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("First Admin Signup")
    
    # Check if first-time setup is available
    try:
        client = get_api_client()
        setup_status = client.check_first_time_setup()
        
        if not setup_status.get("is_first_time_setup"):
            if output_format == "json":
                print_json({"success": False, "error": "First-time setup is not available"})
            else:
                print_error("First-time setup is not available")
                print_info("Users already exist in the system")
                print_info("Use 'rune auth login' to login instead")
            return
            
    except APIError as e:
        if output_format == "json":
            print_json({"success": False, "error": e.message})
        else:
            print_error(f"Failed to check setup status: {e.message}")
        raise click.Abort()
    
    # Prompt for details
    if not name:
        name = prompt_input("Name")
    
    if not email:
        email = prompt_input("Email")
    
    is_valid, error = validate_email(email)
    if not is_valid:
        print_error(error)
        raise click.Abort()
    
    if not password:
        password = prompt_input("Password", hide_input=True)
        confirm_password = prompt_input("Confirm Password", hide_input=True)
        
        if password != confirm_password:
            print_error("Passwords do not match")
            raise click.Abort()
    
    is_valid, error = validate_password(password)
    if not is_valid:
        print_error(error)
        raise click.Abort()
    
    if output_format == "text":
        print_step(1, 3, "Creating admin account...")
    
    try:
        response = client.first_admin_signup(name, email, password)
        
        if output_format == "text":
            print_step(2, 3, "Account created!")
            print_step(3, 3, "Auto-logging in...")
        
        # Auto-login after signup
        try:
            login_response = client.login(email, password)
            access_token = login_response.get("access_token")
            refresh_token = login_response.get("refresh_token")
            
            if access_token:
                token_manager = get_token_manager()
                token_manager.save_token(access_token, email, refresh_token)
                auto_logged_in = True
            else:
                auto_logged_in = False
        except Exception:
            auto_logged_in = False
        
        if output_format == "json":
            print_json({
                "success": True,
                "email": email,
                "name": name,
                "user_id": response.get("user_id"),
                "auto_login": auto_logged_in,
            })
        else:
            console.print()
            print_success("Admin account created successfully!")
            print_divider()
            print_key_value("Name", name)
            print_key_value("Email", email)
            print_key_value("Role", "Admin")
            
            if auto_logged_in:
                print_divider()
                print_success("Automatically logged in!")
                print_info("You can now use all authenticated commands")
            else:
                print_divider()
                print_info("Login with: rune auth login")
                
    except APIError as e:
        if output_format == "json":
            print_json({"success": False, "error": e.message})
        else:
            print_error(f"Signup failed: {e.message}")
        raise click.Abort()


@auth.command("refresh")
@click.pass_context
def refresh(ctx):
    """
    Refresh access token using refresh token.

    \b
    Examples:
        rune auth refresh
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Token Refresh")
    
    token_manager = get_token_manager()
    refresh_token = token_manager.get_refresh_token()
    
    if not refresh_token:
        if output_format == "json":
            print_json({"success": False, "error": "No refresh token available"})
        else:
            print_error("No refresh token available")
            print_info("Please login again with: rune auth login")
        raise click.Abort()
    
    try:
        client = get_api_client()
        response = client.refresh_token(refresh_token)
        
        access_token = response.get("access_token")
        if access_token:
            email = token_manager.get_email()
            token_manager.save_token(access_token, email, refresh_token)
            
            if output_format == "json":
                print_json({"success": True, "message": "Token refreshed"})
            else:
                print_success("Access token refreshed successfully")
        else:
            raise APIError("No access token in response")
            
    except APIError as e:
        if output_format == "json":
            print_json({"success": False, "error": e.message})
        else:
            print_error(f"Token refresh failed: {e.message}")
            print_info("Please login again with: rune auth login")
        raise click.Abort()
