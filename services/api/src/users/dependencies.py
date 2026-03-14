from src.auth.token_store import TokenStore
from src.core.dependencies import DatabaseDep, RedisDep
from src.users.service import UserService


def get_user_service(db: DatabaseDep) -> UserService:
    return UserService(db=db)


def get_token_store(redis: RedisDep) -> TokenStore:
    return TokenStore(redis_client=redis)
