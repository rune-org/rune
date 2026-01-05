from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from fastapi.middleware.cors import CORSMiddleware
from src.core.config import get_settings
from src.core.exception_handlers import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from src.db.config import init_db
from src.db.redis import close_redis
from src.queue.rabbitmq import close_rabbitmq
from src.smith.service import setup_smith
from src.auth.router import router as auth_router
from src.workflow.router import router as workflow_router
from src.executions.router import router as executions_router
from src.permissions.router import router as permissions_router
from src.templates.router import router as templates_router
from src.users.routers import admin_router, profile_router, sharing_router
from src.credentials.router import router as credentials_router
from src.scryb.router import router as scryb_router
from src.smith.router import router as smith_router

# Get settings
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting {settings.app_name} in {settings.environment.value} mode...")
    await init_db()
    await setup_smith()
    yield
    # Shutdown
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
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
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
