"""
CLI-specific API endpoints for the RUNE admin shell.

This module provides read-only database introspection and safe cleanup
endpoints exclusively for the CLI tool. Admin auth is required.

No raw SQL. No schema-breaking operations. Manipulations happen through
the existing domain APIs (workflows, users, etc.).
"""
