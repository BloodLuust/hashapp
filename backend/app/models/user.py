from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import time


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    created_at: float


def to_public(doc: dict) -> UserPublic:
    return UserPublic(id=doc["_id"], email=doc["email"], created_at=doc.get("created_at", time.time()))

