import secrets
import jwt
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

from src.core.config import get_settings
from src.core.exceptions import TokenExpiredError, InvalidTokenError
from src.db.models import User

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession


ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        ph.verify(hashed_password, plain_password)
        return True
    except (VerifyMismatchError, InvalidHashError):
        return False


async def create_access_token(user: User, db: "AsyncSession" = None) -> str:
    """
    Create access token for user.
    Updates last_login_at timestamp if db session is provided.
    """
    settings = get_settings()

    if not settings.jwt_secret_key:
        raise ValueError("JWT_SECRET_KEY is not configured")

    # Update last_login_at if db session is available
    if db is not None:
        user.last_login_at = datetime.now()
        db.add(user)
        await db.commit()
        await db.refresh(user)

    now = datetime.now(timezone.utc)
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = now + expires_delta

    #! Should INCLUDE ALL USER DATA NEEDED FOR AUTHORIZATION DECISIONS
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "iat": now,
        "exp": expire,
        "created_at": user.created_at.isoformat(),
        "updated_at": user.updated_at.isoformat(),
    }

    encoded_jwt = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return encoded_jwt


def decode_access_token(token: str) -> User:
    settings = get_settings()

    if not settings.jwt_secret_key:
        raise ValueError("JWT_SECRET_KEY is not configured")

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        user = User(
            id=int(payload["sub"]),
            email=payload["email"],
            name=payload["name"],
            role=payload.get("role", "user"),
            created_at=datetime.fromisoformat(payload["created_at"]),
            updated_at=datetime.fromisoformat(payload["updated_at"]),
        )
        return user
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError(detail="Access token expired")
    except jwt.InvalidTokenError:
        raise InvalidTokenError(detail="Invalid access token")
    except (KeyError, ValueError) as e:
        raise InvalidTokenError(detail=f"Invalid token payload: {str(e)}")


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(64)
