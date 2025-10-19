from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from src.db.models import UserRole


class UserCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=40)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole = Field(
        default=UserRole.USER, description="User role: 'user' or 'admin'"
    )


class AdminUserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=40)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=40)
    email: Optional[EmailStr] = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole
    is_active: bool = Field(..., description="Account active status")
    created_at: datetime = Field(..., description="Account creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    last_login_at: Optional[datetime] = Field(None, description="Last login timestamp")

    class Config:
        from_attributes = True  # Allows creation from SQLModel objects
