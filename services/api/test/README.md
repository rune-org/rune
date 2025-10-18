# API Testing Guide

## Quick Start

```bash
# 1. Create test environment file
# Copy .env.test.example to .env.test and update if needed
cp .env.test.example .env.test

# 2. Start test databases (from services/api directory)
docker-compose -f docker-compose.dev.yml up -d test-postgres test-redis

# 3. Install test dependencies
pip install -r requirements-test.txt

# 4. Run tests (run from services/api directory where pytest.ini is)
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest test/auth/test_auth.py
```

---

## Test Naming & Discovery

Pytest automatically discovers tests following these rules:

### Test Directory Structure
Mirror the `src/` structure inside `test/`:
```
test/
├── conftest.py           # Shared fixtures
├── auth/
│   ├── __init__.py
│   └── test_auth.py      # Auth-related tests
├── users/
│   ├── __init__.py
│   └── test_users.py     # User-related tests
└── workflow/
    ├── __init__.py
    └── test_workflow.py  # Workflow-related tests
```

### Naming Rules
- **Test files:** Must start with `test_` (e.g., `test_auth.py`, `test_users.py`)
- **Test functions:** Must start with `test_` (e.g., `test_login_success()`)
- **Test classes (optional):** Must start with `Test` (e.g., `TestAuth`)

**Important:** Always run `pytest` from `services/api/` directory (where `pytest.ini` is located).

---

## Writing Your Own Tests

### Basic Pattern
```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_my_endpoint(client: AsyncClient):
    response = await client.get("/my-endpoint")
    assert response.status_code == 200
```

### With Database Setup
```python
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import User

@pytest.mark.asyncio
async def test_with_db_data(client: AsyncClient, test_db: AsyncSession):
    # Create test data
    user = User(email="user@test.com", name="User")
    test_db.add(user)
    await test_db.commit()
    
    # Make request
    response = await client.get(f"/users/{user.id}")
    assert response.status_code == 200
```

### Available Fixtures
- **`client`** - HTTP client for API requests
- **`test_db`** - Database session (auto-rollback after test)
- **`test_redis`** - Redis client (auto-flushed)
- **`test_settings`** - Test configuration

---

## Configuration

### Test Environment (`.env.test`)
- Test Postgres: `localhost:5433`
- Test Redis: `localhost:6380`

### Database Behavior
- Tables created once per test session
- Each test runs in a transaction that rolls back
- No data persists between tests

---

## Clean Up

```bash
# Stop test databases
docker-compose -f docker-compose.dev.yml down test-postgres test-redis

# Or stop all services
docker-compose -f docker-compose.dev.yml down
``` 

