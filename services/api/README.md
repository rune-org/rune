# Rune API Service

A comprehensive FastAPI-based REST API service for the Rune workflow automation platform.

## Setup and Installation

### Prerequisites

Before setting up the Rune API, ensure you have the following installed:

- **Python 3.12+** - Required for FastAPI and modern Python features
- **uv** - Fast Python package manager (replaces pip/venv)
- **Git** - For version control and repository management
- **Docker** (optional) - For containerized deployment

#### Installing uv

```bash
# Using pip
pip install uv
```

For other installation methods, see the [official installation guide](https://docs.astral.sh/uv/getting-started/installation/).

### Virtual Environment

> **📦 Migration Note:** We've moved from `pip` + `venv` to `uv` for dependency management.
> 
> **Old workflow:** `python -m venv .venv` → activate → `pip install -r requirements.txt` → track in `requirements.txt`  
> **New workflow:** `uv sync` → `uv run <command>` → tracked in `pyproject.toml` + `uv.lock`
> 
> **Key changes:**
> - No manual venv creation or activation needed
> - `uv add <package>` replaces `pip install` + manual requirements.txt editing
> - `uv add --dev <package>` for dev dependencies (pytest, linters, etc.)
> - `uv run <command>` replaces activating venv before running commands

uv automatically manages virtual environments for you. When you run `uv sync`, it:
1. Creates a `.venv` directory (if it doesn't exist)
2. Installs all dependencies from `pyproject.toml`
3. Separates production dependencies from dev dependencies (testing tools, linters, etc.)
4. Generates a `uv.lock` file for reproducible builds

No manual activation required - just prefix your commands with `uv run`.

### Installation

1. **Clone the repository and navigate to API service:**

   ```bash
   git clone https://github.com/rune-org/rune.git
   cd rune/services/api
   ```

2. **Install Python dependencies:**

   ```bash
   # uv handles venv creation and dependency installation
   uv sync
   ```

3. **Create environment configuration:**

   ```bash
   # Copy example environment file
   cp .env.example .env

   # Edit .env file with your configuration
   # Use your preferred text editor
   code .env  # or nano .env
   ```

4. **For local development with auto-reload:**

   ```bash
   # uv run automatically uses the .venv
   uv run fastapi dev src/app.py
   ```

### Adding/Managing Dependencies

**Add a production dependency:**
```bash
uv add <package-name>
```

**Add a dev dependency** (testing tools, linters, etc.):
```bash
uv add --dev <package-name>
```

**Remove a dependency:**
```bash
uv remove <package-name>
```

Dependencies are automatically organized in `pyproject.toml` under `[project.dependencies]` (production) and `[dependency-groups.dev]` (development), with locked versions in `uv.lock`.

### Using Docker

For containerized deployment, you can use Docker:

1. **Build the Docker image:**

   ```bash
   # From the API service directory
   docker build -t rune-api .
   ```

2. **Run container:**
   ```bash
   docker run rune-api
   ```

## Project Structure

```
services/api/
├── src/                          # Main application source code
│   ├── __init__.py
│   ├── app.py                    # FastAPI application entry point and configuration
│   ├── core/                     # Core components (shared logic)
│   │   ├── __init__.py
│   │   ├── config.py             # Application settings and environment configuration
│   │   ├── dependencies.py       # Shared FastAPI dependencies (for auth, etc.)
│   │   ├── exceptions.py         # HTTP exception classes
│   │   ├── exception_handlers.py # Global exception handlers for FastAPI
│   │   └── responses.py          # Standardized API response models
│   ├── auth/                     # Auth functionality
│   │   ├── __init__.py
│   │   ├── router.py             # Auth endpoints
│   │   ├── schemas.py            # Auth models for requests/responses
│   │   └── utils.py              # Auth utilities and service validation
│   └── models/                   # Database models and base schemas
│       └── __init__.py
├── .env.example                  # environment variables used by the application
├── pyproject.toml                # Project metadata and dependencies
├── uv.lock                       # Locked dependency versions
├── Dockerfile                    # Container configuration for deployment
└── README.md                     # Comprehensive documentation (this file)
```

## Code Conventions

🚀 **Coding with Style: Rune Edition** 🚀

We believe clean code is readable code! Our project adheres to these coding conventions:

### Variable Naming

- Use `snake_case` for variables and function names (`user_id`, `get_current_user`)
- Prefix private variables with underscore (`_internal_state`) to signal "look but don't touch!"

### Class Naming

- Use `PascalCase` for class names (`UserModel`, `AuthenticationService`)
- Remember: Classes are nouns that deserve capital letters!

### Type Hints

All functions and methods should include proper type hints for that IDE autocomplete:

```python
from src.models.user import UserModel

def get_user_by_id(user_id: str) -> UserModel:
    # Function implementation
    pass
```

### Imports

Always use absolute imports to prevent dependency nightmares:

```python
# ✅ DO THIS
from src.models.auth import TokenData
from src.utils.chat import format_message

# ❌ NOT THIS
from ..models.auth import TokenData
from .chat import format_message
```

## API Documentation

### Interactive Documentation

The API provides comprehensive interactive documentation:

- **Swagger UI**: `http://localhost:8000/docs` - Interactive API testing interface
- **ReDoc**: `http://localhost:8000/redoc` - Clean, comprehensive API documentation
- **OpenAPI Schema**: `http://localhost:8000/openapi.json` - Machine-readable API specification
