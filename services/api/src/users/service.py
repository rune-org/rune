from sqlmodel import select, or_
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import User
from src.core.exceptions import AlreadyExists, NotFound, Unauthorized
from src.users.schemas import UserCreate, AdminUserUpdate, ProfileUpdate
from src.auth.security import hash_password, verify_password
import secrets
import string


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _generate_temporary_password(self) -> str:
        """
        Generate a random temporary password.
        Include uppercase, lowercase, digits, and special characters.

        Returns:
            8-character temporary password string
        """
        alphabet = string.ascii_letters + string.digits + string.punctuation
        return "".join(secrets.choice(alphabet) for _ in range(8))

    async def validate_email_uniqueness(
        self, new_email: str, current_email: str
    ) -> str:
        """
        Helper to validate email uniqueness and normalize it.

        Returns:
            Normalized (lowercase) email

        Raises:
            AlreadyExists: If email is already taken by another user
        """
        normalized_email = new_email.lower()

        # Only check if email is actually changing
        if normalized_email != current_email.lower():
            existing_user = await self.get_user_by_email(normalized_email)
            if existing_user:
                raise AlreadyExists(detail=f"Email {new_email} is already taken")

        return normalized_email

    async def get_all_users(self) -> list[User]:
        """
        Retrieve all users from the database.

        Returns:
            List of all User objects
            [User(id=1, name="someone"...), User(id=2, name="someone2"...)]
        """
        statement = select(User)
        result = await self.db.exec(statement)
        users = result.all()

        return users

    async def get_users_for_sharing(self, exclude_user_id: int) -> list[User]:
        """
        Retrieve all active users for sharing purposes.

        Args:
            exclude_user_id: The ID of the current user to exclude from the list

        Returns:
            List of active User objects (excluding the current user)
        """
        statement = select(User).where(
            User.id != exclude_user_id,
            User.is_active == True,  # noqa: E712
        )
        result = await self.db.exec(statement)
        return result.all()

    async def search_users_for_sharing(
        self,
        exclude_user_id: int,
        search: str | None = None,
        limit: int = 10,
    ) -> list[User]:
        """
        Search active users for sharing purposes with optional filtering.

        Args:
            exclude_user_id: The ID of the current user to exclude
            search: Optional search term to filter by name or email
            limit: Maximum number of results to return (default: 10)

        Returns:
            List of matching active User objects
        """
        statement = select(User).where(
            User.id != exclude_user_id,
            User.is_active,
        )

        if search and search.strip():
            search_term = f"%{search.strip().lower()}%"
            statement = statement.where(
                or_(
                    User.name.ilike(search_term),
                    User.email.ilike(search_term),
                )
            )

        statement = statement.limit(limit)
        result = await self.db.exec(statement)
        return result.all()

    async def get_user_by_id(self, user_id: int) -> User:
        """
        Retrieve a single user by their ID.

        Returns:
            User object if found
            User(id=1, name="someone", email="someone@example.com"...)
        """
        user = await self.db.get(User, user_id)
        if not user:
            raise NotFound(detail=f"User with id {user_id} not found")

        return user

    async def get_user_by_email(self, email: str) -> User | None:
        """
        Retrieve a user by their email address.

        Returns:
            User object if found, None otherwise
        """
        statement = select(User).where(User.email == email.lower())

        # Execute and get first result
        result = await self.db.exec(statement)
        user = result.first()

        return user  # Or None

    async def create_user(self, user_data: UserCreate) -> tuple[User, str]:
        """
        Create a new user in the database with auto-generated temporary password.
        All newly created users (including admins) must change their password on first sign up.

        Returns:
            Tuple of (User object, Temporary password string)

        Raises:
            AlreadyExists: If email is already registered
        """
        # Normalize email to lowercase for case-insensitive checking
        normalized_email = user_data.email.lower()

        # Check if email already exists
        existing_user = await self.get_user_by_email(normalized_email)
        if existing_user:
            raise AlreadyExists(
                detail=f"User with email {user_data.email} already exists"
            )

        temp_password = self._generate_temporary_password()
        hashed_password = hash_password(temp_password)
        must_change = True

        user = User(
            name=user_data.name,
            email=normalized_email,
            hashed_password=hashed_password,
            role=user_data.role.value,
            must_change_password=must_change,
        )

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        return user, temp_password

    async def delete_user(self, user_id: int) -> None:
        """
        Delete a user from the database (permanent removal).

        Raises:
            NotFound: If user doesn't exist
        """
        user = await self.get_user_by_id(user_id)
        await self.db.delete(user)
        await self.db.commit()

    # Admin-Specific Operation
    async def admin_update_user(self, user_id: int, user_data: AdminUserUpdate) -> User:
        """
        Update an existing user's information by admin.

        Returns:
            Updated User object

        Raises:
            NotFound: If user doesn't exist
            AlreadyExists: If new email already taken by another user
        """
        user = await self.get_user_by_id(user_id)

        # Update only provided fields
        update_data = user_data.model_dump(exclude_unset=True)

        # Validate and normalize email if provided
        if "email" in update_data:
            update_data["email"] = await self.validate_email_uniqueness(
                update_data["email"], user.email
            )

        # Apply updates
        for key, value in update_data.items():
            setattr(user, key, value)

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        return user

    # Admin-Specific Operation
    async def admin_reset_user_password(self, user_id: int) -> str:
        """
        Generate a temporary password for a user and mark their account
        to require password change.

        Returns:
            Temporary password string

        Raises:
            NotFound: If user doesn't exist
        """
        user = await self.get_user_by_id(user_id)

        # Generate a random temporary password
        temp_password = self._generate_temporary_password()

        # Hash and update password
        user.hashed_password = hash_password(temp_password)
        user.must_change_password = True

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        return temp_password

    # Self-Service Operation
    async def update_profile(self, user_id: int, profile_data: ProfileUpdate) -> User:
        """
        Self-service profile update.

        Returns:
            Updated User object

        Raises:
            AlreadyExists: If new email already taken
        """
        user = await self.get_user_by_id(user_id)

        # Update only provided fields
        update_data = profile_data.model_dump(exclude_unset=True)

        # Validate and normalize email if provided
        if "email" in update_data:
            update_data["email"] = await self.validate_email_uniqueness(
                update_data["email"], user.email
            )

        # Apply updates
        for key, value in update_data.items():
            setattr(user, key, value)

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        return user

    # Self-Service Operation
    async def user_change_password(
        self, user_id: int, old_password: str, new_password: str
    ) -> User:
        """
        Allow user to change their password.
        Requires verification of old password.
        Clears must_change_password flag if set.

        Returns:
            Updated User object

        Raises:
            NotFound: If user doesn't exist
            ValueError: If old password is incorrect
        """
        user = await self.get_user_by_id(user_id)

        # Verify old password
        if not verify_password(old_password, user.hashed_password):
            raise Unauthorized(detail="Old password is incorrect")

        user.hashed_password = hash_password(new_password)
        user.must_change_password = False

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        return user
