from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
import uuid

class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: Optional[str] = None

class DocumentSeal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    file_name: str
    file_size: str
    file_type: str
    sha256_hash: str
    transaction_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str = "sealed"  # sealed, pending, failed

class DocumentSealCreate(BaseModel):
    file_name: str
    file_size: str
    file_type: str
    sha256_hash: str
    transaction_id: str

class DocumentSealResponse(DocumentSeal):
    pass