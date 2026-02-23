from src.auth.token_store import TokenStore
from src.core.dependencies import DatabaseDep, RedisDep
from src.users.service import UserService


def get_user_service(db: DatabaseDep, redis: RedisDep) -> UserService:
    return UserService(db=db, token_store=TokenStore(redis_client=redis))
