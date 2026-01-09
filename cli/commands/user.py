"""
User Commands

Commands for user profile management.
"""

import click

from cli.client import get_api_client, APIError
from cli.styles import (
    print_header,
    print_success,
    print_error,
    print_info,
    print_divider,
    print_key_value,
    print_json,
    prompt_input,
)
from cli.utils import format_datetime, validate_password


@click.group()
def user():
    """
    User profile commands.

    \b
    Manage your user profile and settings.
    """
    pass


@user.command("me")
@click.pass_context
def get_profile(ctx):
    """
    Get your profile information.

    \b
    Examples:
        rune user me
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("My Profile")

    try:
        client = get_api_client()
        profile = client.get("/api/profile/me")

        if output_format == "json":
            print_json(profile)
        else:
            print_key_value("ID", profile.get("id"))
            print_key_value("Name", profile.get("name"))
            print_key_value("Email", profile.get("email"))
            print_key_value("Role", profile.get("role"))
            print_key_value("Active", "Yes" if profile.get("is_active") else "No")
            print_key_value("Created", format_datetime(profile.get("created_at")))
            print_key_value("Last Login", format_datetime(profile.get("last_login_at")))

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to get profile: {e.message}")
        raise click.Abort()


@user.command("update")
@click.option("--name", "-n", help="New name")
@click.pass_context
def update_profile(ctx, name: str):
    """
    Update your profile information.

    \b
    Examples:
        rune user update -n "New Name"
    """
    output_format = ctx.obj.get("output", "text")
    
    if not name:
        print_error("Please provide a new name with --name")
        raise click.Abort()
    
    if output_format == "text":
        print_header("Update Profile")

    try:
        client = get_api_client()
        profile = client.put("/api/profile/me", data={"name": name})

        if output_format == "json":
            print_json(profile)
        else:
            print_success("Profile updated successfully!")
            print_divider()
            print_key_value("Name", profile.get("name"))

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to update profile: {e.message}")
        raise click.Abort()


@user.command("change-password")
@click.pass_context
def change_password(ctx):
    """
    Change your password.

    \b
    Examples:
        rune user change-password
    """
    output_format = ctx.obj.get("output", "text")
    
    if output_format == "text":
        print_header("Change Password")
    
    # Prompt for passwords
    old_password = prompt_input("Current Password", hide_input=True)
    new_password = prompt_input("New Password", hide_input=True)
    confirm_password = prompt_input("Confirm New Password", hide_input=True)
    
    if new_password != confirm_password:
        print_error("Passwords do not match")
        raise click.Abort()
    
    is_valid, error = validate_password(new_password)
    if not is_valid:
        print_error(error)
        raise click.Abort()

    try:
        client = get_api_client()
        response = client.post("/api/profile/me/change-password", data={
            "old_password": old_password,
            "new_password": new_password,
        })

        if output_format == "json":
            print_json({"success": True})
        else:
            print_success("Password changed successfully!")
            
            # If we got a new token, save it
            new_token = response.get("access_token")
            if new_token:
                from cli.auth import get_token_manager
                token_manager = get_token_manager()
                email = token_manager.get_email()
                token_manager.save_token(new_token, email)
                print_info("Authentication token updated")

    except APIError as e:
        if output_format == "json":
            print_json({"error": e.message})
        else:
            print_error(f"Failed to change password: {e.message}")
        raise click.Abort()
