from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    """Current allowed user roles in the system."""
    USER = "user"
    ADMIN = "admin"



class UserCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=40)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole = Field(default=UserRole.USER, description="User role: 'user' or 'admin'")

# Note: role is intentionally excluded from update schemas to prevent privilege escalation

class AdminUserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=40)
    email: Optional[EmailStr]
    is_active: Optional[bool]


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=40)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)


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