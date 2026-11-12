from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, model_validator


class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    approval_status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    approved_at: Optional[datetime] = None
    approved_by: Optional[int] = None

    class Config:
        from_attributes = True


class UserApprovalUpdate(BaseModel):
    action: str = Field(..., description="'approve' or 'reject'")


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserRoleUpdate(BaseModel):
    role: str = Field(..., description="'admin' or 'agent'")


class UserReapply(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    password: Optional[str] = None

