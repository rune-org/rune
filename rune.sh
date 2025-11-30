#!/usr/bin/env bash
#
# Rune CLI - Workflow Automation Platform Management Tool
#
# Wrapper script to run the Rune CLI from anywhere in the project.
# Automatically uses the API virtual environment.
#
# Usage:
#   ./rune.sh --help
#   ./rune.sh admin inject-admin
#   ./rune.sh db status

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/services/api"
VENV_PYTHON="$API_DIR/.venv/bin/python"

# Check if venv exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo -e "\033[31mError: Virtual environment not found at $API_DIR/.venv\033[0m"
    echo ""
    echo -e "\033[33mPlease set up the API environment first:\033[0m"
    echo "  cd services/api"
    echo "  python -m venv .venv"
    echo "  source .venv/bin/activate"
    echo "  pip install -r requirements.txt"
    exit 1
fi

# Run the CLI using the venv Python from the API directory
cd "$API_DIR"
exec "$VENV_PYTHON" -m src.cli "$@"
