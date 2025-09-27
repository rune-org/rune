# Rune API Service

A comprehensive FastAPI-based REST API service for the Rune workflow automation platform.

## Setup and Installation

### Prerequisites

Before setting up the Rune API, ensure you have the following installed:

- **Python 3.12+** - Required for FastAPI and modern Python features
- **Git** - For version control and repository management
- **Docker** (optional) - For containerized deployment

### Virtual Environment

It's strongly recommended to use a virtual environment to isolate project dependencies:

#### Using venv (Built-in Python module)

```bash
# Navigate to the API service directory
cd services/api

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows using powershell
.venv\Scripts\Activate.ps1
# On macOS/Linux:
source .venv/bin/activate

```

### Installation

1. **Clone the repository and navigate to API service:**

   ```bash
   git clone https://github.com/rune-org/rune.git
   cd rune/services/api
   ```

2. **Install Python dependencies:**

   ```bash
   # Make sure your virtual environment is activated
   pip install -r requirements.txt
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
   # Make sure virtual environment is activated
   # From services/api directory

   # Install development dependencies
   pip install -r requirements.txt

   # Run with auto-reload for development
   fastapi dev src/app.py
   ### Using Docker
```

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
├── requirements.txt              # Python dependencies
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
