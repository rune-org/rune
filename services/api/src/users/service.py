from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import User
from src.core.exceptions import AlreadyExists, NotFound
from src.users.schemas import UserCreate, UserUpdate
from src.auth.security import hash_password



class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

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
        statement = select(User).where(User.email == email)
        
        # Execute and get first result 
        result = await self.db.exec(statement)
        user = result.first()
        
        return user # Or None

    async def create_user(self, user_data: UserCreate) -> User:
        """
        Create a new user in the database.
            
        Returns:
            Newly created User object
            
        Raises:
            AlreadyExists: If email is already registered
        """
        # Check if email already exists
        existing_user = await self.get_user_by_email(user_data.email)
        if existing_user:
            raise AlreadyExists(detail=f"User with email {user_data.email} already exists")
        
        hashed_password = hash_password(user_data.password)

        user = User(
            **user_data.model_dump(),
            hashed_password=hashed_password,
        )
        
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user) # Refresh to get auto generated fields
        
        return user

    async def update_user(self, user_id: int, user_data: UserUpdate) -> User:
        """
        Update an existing user's information.
            
        Returns:
            Updated User object
            
        Raises:
            NotFound: If user doesn't exist
            AlreadyExists: If new email already taken by another user
        """
        # Get existing user
        user = await self.get_user_by_id(user_id)
        
        # If email is being changed, check it's not taken
        if user_data.email and user_data.email != user.email:
            existing_user = await self.get_user_by_email(user_data.email)
            if existing_user:
                raise AlreadyExists(detail=f"Email {user_data.email} is already taken")
        
        # Update only the fields that were provided
        update_data = user_data.model_dump(exclude_unset=True)
        
        # Handling for password
        if "password" in update_data:
            plain_password = update_data.pop("password")
            update_data["hashed_password"] = hash_password(plain_password)
        
        # Apply all updates to the user object
        for key, value in update_data.items():
            setattr(user, key, value)
        
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        
        return user

    async def delete_user(self, user_id: int) -> bool:
        """
        Delete a user from the database (permanent removal).
    
        Returns:
            True if deletion was successful
            
        Raises:
            NotFound: If user doesn't exist
        """
        user = await self.get_user_by_id(user_id)
        await self.db.delete(user)
        await self.db.commit()
        
        return True