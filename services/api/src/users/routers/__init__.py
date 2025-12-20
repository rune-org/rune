from src.users.routers.admin import router as admin_router
from src.users.routers.profile import router as profile_router
from src.users.routers.sharing import router as sharing_router

__all__ = ["admin_router", "profile_router", "sharing_router"]
