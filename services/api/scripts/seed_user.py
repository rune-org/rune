"""
python -m scripts.seed_user
"""

import asyncio

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.password import hash_password
from src.db.config import get_async_engine, init_db
from src.db.models import User, UserRole


async def seed_test_user():
    """Create a test user if it doesn't already exist."""
    # Initialize database tables if they don't exist
    print("Initializing database...")
    await init_db()

    engine = get_async_engine()

    async with AsyncSession(engine, expire_on_commit=False) as session:
        # Check if user already exists
        statement = select(User).where(User.email == "test@example.com")
        result = await session.exec(statement)
        existing_user = result.first()

        if existing_user:
            print(
                f"User with email 'test@example.com' already exists (ID: {existing_user.id})"
            )
            return

        # Create new test user
        hashed_password = hash_password("password")
        test_user = User(
            email="test@example.com",
            hashed_password=hashed_password,
            name="Test User",
            role=UserRole.ADMIN,
            must_change_password=False,
        )

        session.add(test_user)
        await session.commit()
        await session.refresh(test_user)

        print("Test user created successfully!")
        print(f"  ID: {test_user.id}")
        print(f"  Name: {test_user.name}")
        print(f"  Email: {test_user.email}")
        print(f"  Role: {test_user.role}")


if __name__ == "__main__":
    asyncio.run(seed_test_user())
