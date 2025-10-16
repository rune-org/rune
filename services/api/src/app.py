from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.core.config import get_settings
from src.core.exception_handlers import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from src.db.config import init_db
from src.db.redis import close_redis
from src.auth.router import router as auth_router
from src.workflow.router import router as workflow_router
from src.users.router import router as users_router

# Get settings
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting {settings.app_name} in {settings.environment.value} mode...")
    await init_db()
    yield
    # Shutdown
    await close_redis()
    print("Shutting down...")


app = FastAPI(
    title=settings.app_name,
    version="0.0.0",
    lifespan=lifespan,
)

# Register custom exception handlers
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Include routers
app.include_router(auth_router)
app.include_router(workflow_router)
app.include_router(users_router)
