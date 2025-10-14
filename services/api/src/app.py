from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.config import get_settings
from src.db.config import init_db
from src.db.redis import close_redis
from src.queue.rabbitmq import close_rabbitmq
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
    await close_rabbitmq()
    print("Shutting down...")


app = FastAPI(
    title=settings.app_name,
    version="0.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(workflow_router)
app.include_router(users_router)
