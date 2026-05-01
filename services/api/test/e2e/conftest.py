"""E2E test infrastructure.

Launches the API as a real subprocess (separate Python process) so env vars
and module-level settings are isolated from the unit-test process. Tests
make genuine TCP connections to it via httpx.
"""

import os
import subprocess
import sys
import time

import asyncpg
import httpx
import pytest
import pytest_asyncio

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

E2E_HOST = "127.0.0.1"
E2E_PORT = 8799
E2E_BASE_URL = f"http://{E2E_HOST}:{E2E_PORT}"

PG_DSN = "postgresql://test_user:test_password@localhost:5433/test_rune"

# Environment the subprocess API server will run with
_SERVER_ENV = {
    **os.environ,
    "ENVIRONMENT": "dev",
    "POSTGRES_HOST": "localhost",
    "POSTGRES_PORT": "5433",
    "POSTGRES_USER": "test_user",
    "POSTGRES_PASSWORD": "test_password",
    "POSTGRES_DB": "test_rune",
    "REDIS_HOST": "localhost",
    "REDIS_PORT": "6380",
    "REDIS_DB": "1",
    "RABBITMQ_HOST": "localhost",
    "RABBITMQ_PORT": "5673",
    "RABBITMQ_USERNAME": "test_user",
    "RABBITMQ_PASSWORD": "test_password",
    "JWT_SECRET_KEY": "e2e_test_secret_key_not_for_production",
    "ENCRYPTION_KEY": "8eLl-T7Un3Qj5vN9sP2wK4bR6xZ0cF1mA8yD7gH3iE0=",
    # Silence alembic auto-migrate noise
    "PYTHONUNBUFFERED": "1",
}


# ---------------------------------------------------------------------------
# Server lifecycle — one subprocess for the whole e2e session
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def e2e_server():
    """Start a real uvicorn subprocess and wait until it accepts connections."""
    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "src.app:app",
            "--host", E2E_HOST,
            "--port", str(E2E_PORT),
            "--log-level", "warning",
        ],
        env=_SERVER_ENV,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    deadline = time.time() + 30
    started = False
    while time.time() < deadline:
        if proc.poll() is not None:
            out, err = proc.communicate()
            raise RuntimeError(
                f"Server process exited early (code {proc.returncode}).\n"
                f"STDOUT: {out.decode()}\nSTDERR: {err.decode()}"
            )
        try:
            with httpx.Client() as c:
                c.get(f"{E2E_BASE_URL}/docs", timeout=1)
            started = True
            break
        except Exception:
            time.sleep(0.3)

    if not started:
        proc.kill()
        out, err = proc.communicate()
        raise RuntimeError(
            f"E2E server did not start within 30 seconds.\n"
            f"STDERR: {err.decode()[-3000:]}"
        )

    yield E2E_BASE_URL

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(scope="function")
async def pg_conn():
    """Raw asyncpg connection for direct DB inspection in e2e tests."""
    conn = await asyncpg.connect(PG_DSN)
    yield conn
    await conn.close()


@pytest_asyncio.fixture(scope="function", autouse=True)
async def clean_db():
    """Truncate all user-data tables between tests for isolation."""
    conn = await asyncpg.connect(PG_DSN)
    try:
        await conn.execute(
            """
            TRUNCATE TABLE
                webhook_registrations,
                scheduled_workflows,
                executions,
                workflow_credential_links,
                workflow_versions,
                workflow_users,
                workflows,
                credential_shares,
                workflow_credentials,
                "samlconfiguration",
                users
            RESTART IDENTITY CASCADE
            """
        )
    finally:
        await conn.close()


# ---------------------------------------------------------------------------
# HTTP clients
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(scope="function")
async def http(e2e_server):
    """Unauthenticated async HTTP client."""
    async with httpx.AsyncClient(base_url=e2e_server, timeout=10) as client:
        yield client


@pytest_asyncio.fixture(scope="function")
async def auth_http(e2e_server):
    """Authenticated async HTTP client (bootstraps admin + logs in)."""
    async with httpx.AsyncClient(
        base_url=e2e_server, timeout=10, follow_redirects=True
    ) as client:
        r = await client.post(
            "/setup/initialize",
            json={
                "name": "E2E Admin",
                "email": "e2e@example.com",
                "password": "E2eTest123!",
            },
        )
        assert r.status_code == 200, f"Setup failed: {r.text}"

        r = await client.post(
            "/auth/login",
            json={"email": "e2e@example.com", "password": "E2eTest123!"},
        )
        assert r.status_code == 200, f"Login failed: {r.text}"

        yield client
