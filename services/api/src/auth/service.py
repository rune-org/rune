from fastapi import Response
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import datetime, timezone

from src.auth.schemas import TokenResponse
from src.auth.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    verify_password,
)
from src.auth.token_store import TokenStore
from src.core.config import get_settings
from src.core.exceptions import InvalidTokenError
from src.db.models import User


class AuthService:
    def __init__(self, db: AsyncSession, token_store: TokenStore):
        self.db = db
        self.token_store = token_store
        self.settings = get_settings()

    async def get_user_by_id(self, user_id: int) -> User | None:
        return await self.db.get(User, user_id)

    async def get_user_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        result = await self.db.exec(statement)
        return result.first()

    async def authenticate_user(self, email: str, password: str) -> User | None:
        """Authenticate user with email and password."""
        user = await self.get_user_by_email(email)

        if not user or not verify_password(password, user.hashed_password):
            return None

        return user

    async def update_last_login(self, user: User) -> None:
        """Update the last_login_at timestamp for a user."""
        user.last_login_at = datetime.now(timezone.utc)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

    async def create_tokens(self, user: User) -> tuple[str, str]:
        """Create access and refresh tokens for user."""
        access_token = create_access_token(user)
        token_part = generate_refresh_token()
        refresh_token = f"{user.id}:{token_part}"
        refresh_token_hash = hash_password(token_part)

        await self.token_store.store_refresh_token(
            user_id=user.id,
            token_hash=refresh_token_hash,
        )

        return access_token, refresh_token

    async def create_auth_response(self, user: User) -> TokenResponse:
        """Create complete authentication response with tokens."""
        access_token, refresh_token = await self.create_tokens(user)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=self.settings.access_token_expire_minutes * 60,
        )

    def _parse_refresh_token(self, refresh_token: str) -> tuple[int, str]:
        """Parse refresh token into user_id and token_part."""
        parts = refresh_token.split(":", 1)
        if len(parts) != 2:
            raise InvalidTokenError(detail="Invalid refresh token format")

        try:
            user_id = int(parts[0])
        except ValueError:
            raise InvalidTokenError(detail="Invalid refresh token format")

        return user_id, parts[1]

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        """Refresh access token"""
        user_id, token_part = self._parse_refresh_token(refresh_token)

        stored_hash = await self.token_store.get_refresh_token(user_id, token_part)
        if not stored_hash:
            raise InvalidTokenError(detail="Refresh token not found")

        user = await self.get_user_by_id(user_id)
        if not user:
            raise InvalidTokenError(detail="User not found")

        new_access_token = create_access_token(user)

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=self.settings.access_token_expire_minutes * 60,
        )

    async def logout_user_by_id(self, user_id: int) -> bool:
        """Logout user by revoking all refresh tokens associated with user ID."""
        return await self.token_store.revoke_user_tokens(user_id)

    def set_auth_cookie(self, response: Response, access_token: str) -> None:
        """Set authentication cookie in response."""
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=self.settings.cookie_secure,
            max_age=self.settings.access_token_expire_minutes * 60,
        )

    def clear_auth_cookie(self, response: Response) -> None:
        """Clear authentication cookie from response."""
        response.delete_cookie(
            key="access_token",
            httponly=True,
        )
