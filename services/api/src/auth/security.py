import secrets
import jwt
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

from src.core.config import get_settings
from src.core.exceptions import TokenExpiredError, InvalidTokenError
from src.db.models import User


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


def create_access_token(user: User) -> str:
    settings = get_settings()

    if not settings.jwt_secret_key:
        raise ValueError("JWT_SECRET_KEY is not configured")

    now = datetime.now(timezone.utc)
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = now + expires_delta

    payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.name,
        "iat": now,
        "exp": expire,
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
