"""
Rune CLI - Package entry point

Allows running the CLI as a module:
    python -m src.cli [COMMAND] [OPTIONS]
"""

from .main import main

if __name__ == "__main__":
    main()
