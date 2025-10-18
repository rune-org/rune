# API Testing Guide

## How to Run Tests

```bash
# One-time setup
cp .env.test.example .env.test
pip install -r requirements.txt

# Start test infrastructure
docker-compose -f docker-compose.test.yml up -d

# Run tests (from services/api directory)
pytest                  # All tests
pytest -v               # Verbose
pytest test/auth/       # Specific directory
pytest test/auth/test_auth.py::test_login_success  # Specific test

# Stop and cleanup
docker-compose -f docker-compose.test.yml down -v
```

## Test Discovery & Naming

Pytest automatically finds tests using these rules:

**Directory structure:** Mirror `src/` in `test/`
```
test/
├── conftest.py        # Shared fixtures
├── auth/
│   ├── __init__.py
│   └── test_auth.py
└── users/
    └── test_users.py
```

**Naming:**
- Files: `test_*.py`
- Functions: `test_*()`
- Classes: `Test*` (optional)

## Fixtures

**What are fixtures?** Setup code that runs before tests. Pytest automatically passes them as function parameters.

**Available fixtures:**

| Fixture | Description |
|---------|-------------|
| `client` | Unauthenticated HTTP client |
| `authenticated_client` | HTTP client with logged-in user |
| `admin_client` | HTTP client with logged-in admin |
| `test_db` | Database session (auto-rollback) |
| `test_user` | Regular user in database |
| `test_admin` | Admin user in database |
| `test_redis` | Redis client (auto-flushed) |
| `test_rabbitmq` | RabbitMQ connection |

**Creating your own:** Add to `test/conftest.py`
```python
import pytest_asyncio
from sqlmodel.ext.asyncio.session import AsyncSession

@pytest_asyncio.fixture(scope="function")
async def my_fixture(test_db: AsyncSession):
    # Setup
    data = create_test_data()
    yield data
    # Cleanup (optional)
```

Scopes: `function` (per test) or `session` (once for all tests)

## Writing Tests

**Basic pattern:**
```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_endpoint(client: AsyncClient):
    response = await client.get("/endpoint")
    assert response.status_code == 200
    assert response.json()["success"] is True
```

## Notes

- Run from `services/api/` directory (where `pytest.ini` is)
- Database rolls back after each test (no data persists)
- Test services run on different ports (Postgres: 5433, Redis: 6380, RabbitMQ: 5673)
