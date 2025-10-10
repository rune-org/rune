from contextlib import asynccontextmanager
from fastapi import FastAPI

from src.core.config import get_settings
from src.db.config import init_db
from src.db.redis import close_redis
from src.auth.router import router as auth_router
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

app.include_router(auth_router)
app.include_router(users_router)
