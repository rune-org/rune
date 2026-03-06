#!/usr/bin/env bash
#
# Rune CLI - Workflow Automation Platform Management Tool
#
# Wrapper script to run the Rune CLI from anywhere in the project.
# Uses CLI's own virtual environment (standalone from API).
#
# Usage:
#   ./rune.sh --help
#   ./rune.sh auth login
#   ./rune.sh workflow list
#
# Architecture:
#   CLI (this) --HTTP--> API Server (services/api) ---> Database
#   The CLI is a standalone HTTP client that communicates with the API.
#   The API server must be running for most commands to work.

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$SCRIPT_DIR/rune_cli"

# CLI has its own venv (standalone from API)
CLI_VENV="$CLI_DIR/.venv"
VENV_PYTHON="$CLI_VENV/bin/python"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to setup CLI virtual environment
setup_cli_venv() {
    print_info "Setting up Rune CLI virtual environment..."
    
    # Check Python version
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is required but not found"
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    print_info "Found Python $PYTHON_VERSION"
    
    # Create venv
    print_info "Creating virtual environment at $CLI_VENV..."
    python3 -m venv "$CLI_VENV"
    
    # Upgrade pip
    print_info "Upgrading pip..."
    "$VENV_PYTHON" -m pip install --upgrade pip --quiet
    
    # Install CLI package
    print_info "Installing Rune CLI package..."
    "$VENV_PYTHON" -m pip install -e "$CLI_DIR" --quiet
    
    print_success "Rune CLI setup complete!"
    echo ""
}

# Check if CLI venv exists, create if not
if [ ! -f "$VENV_PYTHON" ]; then
    print_warning "CLI virtual environment not found at $CLI_VENV"
    echo ""
    read -p "Would you like to set it up now? [Y/n] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        setup_cli_venv
    else
        print_error "Cannot run CLI without virtual environment"
        echo ""
        echo "To set up manually:"
        echo "  cd $CLI_DIR"
        echo "  python3 -m venv .venv"
        echo "  source .venv/bin/activate"
        echo "  pip install -e ."
        exit 1
    fi
fi

# Run the CLI
exec "$VENV_PYTHON" -m rune_cli "$@"
