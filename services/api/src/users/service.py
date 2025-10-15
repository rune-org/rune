from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import User
from src.core.exceptions import AlreadyExists, NotFound
from src.users.schemas import UserCreate, AdminUserUpdate, ProfileUpdate
from src.auth.security import hash_password


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

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

    async def create_user(self, user_data: UserCreate) -> User:
        """
        Create a new user in the database.

        Returns:
            Newly created User object

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

        hashed_password = hash_password(user_data.password)

        user = User(
            name=user_data.name,
            email=normalized_email,
            hashed_password=hashed_password,
            role=user_data.role.value,
        )

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        return user

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
