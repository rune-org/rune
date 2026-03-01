from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import Forbidden
from src.core.password import hash_password
from src.db.models import User, UserRole
from src.setup.schemas import FirstAdminSignupRequest
from src.users.utils import normalize_email


class SetupService:
    """Service responsible for system initialization (first-time setup)."""

    def __init__(self, db: AsyncSession):
        self.db = db

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
        raise a Forbidden exception.

        Args:
            signup_data: First admin signup information

        Returns:
            Created admin user object

        Raises:
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
