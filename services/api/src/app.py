from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from src.core.config import get_settings
from src.core.exception_handlers import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from src.db.config import init_db, build_connection_string, get_async_engine
from src.db.redis import close_redis
from src.queue.rabbitmq import close_rabbitmq
from src.smith.agent import create_smith_agent
from src.scryb.agent import create_scryb_agent
from src.auth.router import router as auth_router
from src.auth.saml.router import router as saml_router
from src.setup.router import router as setup_router
from src.workflow.router import router as workflow_router
from src.workflow.service import run_credential_backfill
from src.executions.router import router as executions_router
from src.permissions.router import router as permissions_router
from src.templates.router import router as templates_router
from src.templates.seeder import seed_templates_from_bundle
from src.users.routers import admin_router, profile_router, sharing_router
from src.credentials.router import router as credentials_router
from src.scryb.router import router as scryb_router
from src.smith.router import router as smith_router
from src.internal.router import router as internal_router
from sqlmodel.ext.asyncio.session import AsyncSession
from src.oauth.router import router as oauth_router
from src.webhook.router import router as webhook_router

# Get settings
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting {settings.app_name} in {settings.environment.value} mode...")
    await init_db()

    # Run credential backfill to ensure legacy workflows are tracked
    async_engine = get_async_engine()
    async with AsyncSession(async_engine, expire_on_commit=False) as session:
        await run_credential_backfill(session)

    # Seed curated templates from the rune-templates bundle (opt-in). Failures
    # are logged but never crash startup: templates are non-critical content
    # and the rest of the app should keep working even if the bundle is missing
    # or malformed.
    if settings.seed_templates:
        from pathlib import Path

        bundle_dir = Path(settings.rune_templates_bundle_dir)
        if not bundle_dir.is_absolute():
            bundle_dir = (Path(__file__).resolve().parent.parent / bundle_dir).resolve()
        async with AsyncSession(async_engine, expire_on_commit=False) as session:
            try:
                result = await seed_templates_from_bundle(session, bundle_dir)
                print(
                    f"Templates seeded from {bundle_dir}: "
                    f"+{result.inserted} new, ~{result.updated} updated, "
                    f"-{result.removed} removed."
                )
            except Exception as exc:
                print(f"Template seeding failed (continuing without seed): {exc}")

    # Initialize PostgreSQL checkpointer using context manager
    conn_string = build_connection_string(
        user=settings.postgres_user,
        password=settings.postgres_password,
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
        driver="postgresql",
    )
    async with AsyncPostgresSaver.from_conn_string(conn_string) as checkpointer:
        await checkpointer.setup()

        # Optionally load Context7 documentation tools (MCP over streamable HTTP)
        # so Smith can look up external-API usage while building http nodes.
        # Failures never crash startup: Context7 is non-critical and Smith works
        # without it (mirrors the template-seeding precedent). The client is a
        # stateless HTTP client, so there is no shutdown hook.
        context7_tools = []
        if settings.context7_api_key:
            try:
                from langchain_mcp_adapters.client import MultiServerMCPClient

                mcp_client = MultiServerMCPClient(
                    {
                        "context7": {
                            "transport": "streamable_http",
                            "url": "https://mcp.context7.com/mcp",
                            "headers": {"CONTEXT7_API_KEY": settings.context7_api_key},
                        }
                    }
                )
                context7_tools = await mcp_client.get_tools()
                print(f"Context7 tools loaded: {[t.name for t in context7_tools]}")
            except Exception as exc:
                print(f"Context7 load failed (continuing without it): {exc}")
        else:
            print("Context7 disabled (CONTEXT7_API_KEY not set); running without it.")

        # Create the Smith agent with the checkpointer
        app.state.smith_agent = create_smith_agent(
            checkpointer=checkpointer, extra_tools=context7_tools
        )
        # Store checkpointer separately for thread management
        app.state.smith_checkpointer = checkpointer

        # Scryb is a stateless documentation agent (no checkpointer); it reads the
        # shared node_docs on demand. Built once here, retrieved via app.state.
        app.state.scryb_agent = create_scryb_agent()

        yield  # App runs here

    # Shutdown (checkpointer automatically cleaned up by context manager)
    await close_redis()
    await close_rabbitmq()
    print("Shutting down...")


app = FastAPI(
    title=settings.app_name,
    version="0.0.0",
    lifespan=lifespan,
    root_path="/api",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register custom exception handlers
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Include routers
app.include_router(auth_router)
app.include_router(saml_router)
app.include_router(setup_router)
app.include_router(workflow_router)
app.include_router(executions_router)
app.include_router(permissions_router)
app.include_router(sharing_router)  # Register before admin_router for /users/sharing
app.include_router(admin_router)
app.include_router(profile_router)
app.include_router(templates_router)
app.include_router(credentials_router)
app.include_router(scryb_router)
app.include_router(smith_router)
app.include_router(internal_router)
app.include_router(oauth_router)
app.include_router(webhook_router)
