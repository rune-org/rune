"""
Rune CLI Package

A professional command-line interface for managing Rune workflows,
templates, users, executions, and database operations.

Architecture:
    ┌─────────────┐      HTTP       ┌─────────────────┐      SQL       ┌──────────────┐
    │   CLI       │ ───────────────►│   API Server    │ ──────────────►│   Database   │
    │  (rune_cli) │   Port 8000     │  (services/api) │                │  (PostgreSQL)│
    └─────────────┘                 └─────────────────┘                └──────────────┘
    
    The CLI is a standalone HTTP client. The API server must be running
    for most commands (auth, workflow, template, etc.) to work.
    
    Local-only commands (config, some db operations) work without the API.

Features:
    - Token-based authentication (JWT)
    - HTTP client for API communication
    - Direct database access via Docker (for admin operations)
    - Rich terminal output with colors and tables
    - Fully configurable settings (file + env vars)
    - JSON and text output formats
    - Interactive shell mode

Quick Start:
    1. Start the API server: cd services/api && docker compose up -d
    2. Run CLI setup: ./rune.sh (auto-creates venv)
    3. Configure: rune config set-url http://localhost:8000
    4. Login: rune auth login
"""

__version__ = "1.0.0"
__author__ = "Rune Team"
__email__ = "runeteam1011@gmail.com"
__description__ = "Rune Workflow Automation Platform - Professional CLI"

