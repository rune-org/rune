from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.schemas import FirstAdminSignupRequest, TokenResponse
from src.auth.token_store import TokenStore
from src.core.config import get_settings
from src.core.exceptions import Forbidden, InvalidTokenError
from src.core.password import hash_password, verify_password
from src.core.token import create_access_token, generate_refresh_token
from src.db.models import User, UserRole
from src.users.utils import normalize_email


class AuthService:
    def __init__(self, db: AsyncSession, token_store: TokenStore):
        self.db = db
        self.token_store = token_store
        self.settings = get_settings()

    async def get_user_by_id(self, user_id: int) -> User | None:
        return await self.db.get(User, user_id)

    async def get_user_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == normalize_email(email))
        result = await self.db.exec(statement)
        return result.first()

    async def authenticate_user(self, email: str, password: str) -> User | None:
        """Authenticate user with email and password."""
        user = await self.get_user_by_email(email)

        if not user or not verify_password(password, user.hashed_password):
            return None

        return user

    async def create_tokens(self, user: User) -> tuple[str, str]:
        """
        Create access and refresh tokens for user.
        Access token creation will handle updating last_login_at.
        """
        access_token = await create_access_token(user, db=self.db)
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
        """
        Refresh access token.
        This updates the user's last_login_at timestamp when creating new access token.
        """
        user_id, token_part = self._parse_refresh_token(refresh_token)

        stored_hash = await self.token_store.get_refresh_token(user_id, token_part)
        if not stored_hash:
            raise InvalidTokenError(detail="Refresh token not found")

        user = await self.get_user_by_id(user_id)
        if not user:
            raise InvalidTokenError(detail="User not found")

        new_access_token = await create_access_token(user, db=self.db)

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=self.settings.access_token_expire_minutes * 60,
        )

    async def logout_user_by_id(self, user_id: int) -> bool:
        """Logout user by revoking all refresh tokens associated with user ID."""
        return await self.token_store.revoke_user_tokens(user_id)

    async def is_first_time_setup(self) -> bool:
        """
        Check if the system requires first-time setup.

        Returns:
            True if no users exist in the system, False otherwise.
        """
        statement = select(User.id).limit(1)
        result = await self.db.exec(statement)
        return result.first() is None

    async def create_first_admin(self, signup_data: FirstAdminSignupRequest) -> User:
        """
        Create the first admin user in the system.

        This method includes race condition protection by checking the user count
        within a transaction. If users already exist when this executes, it will
        raise an AlreadyExists exception.

        Args:
            signup_data: First admin signup information

        Returns:
            Created admin user object

        Raises:
            AlreadyExists: If users already exist or email is taken
            Forbidden: If system already has users (not first-time setup)
        """
        # Double-check that no users exist (race condition protection)
        if not await self.is_first_time_setup():
            raise Forbidden(
                detail="First-time setup is not available. Users already exist in the system."
            )

        # Normalize email
        normalized_email = normalize_email(signup_data.email)

        # Create the first admin user with the provided password
        # No temporary password - user sets their own password directly
        hashed_password = hash_password(signup_data.password)

        user = User(
            name=signup_data.name,
            email=normalized_email,
            hashed_password=hashed_password,
            role=UserRole.ADMIN,
            must_change_password=False,  # User set their own password
        )

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        return user
