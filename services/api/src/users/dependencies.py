from src.core.dependencies import DatabaseDep
from src.users.service import UserService


def get_user_service(db: DatabaseDep) -> UserService:
    return UserService(db=db)
