from fastapi import APIRouter, Depends, HTTPException, Response, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db.client import get_db
from ..core.security import get_password_hash, verify_password, create_access_token, decode_token
from ..models.user import UserCreate, UserLogin, to_public
from ..core.config import settings


router = APIRouter()


@router.post("/register")
async def register(payload: UserCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "_id": __import__("uuid").uuid4().hex,
        "email": payload.email.lower(),
        "password_hash": get_password_hash(payload.password),
        "created_at": __import__("time").time(),
    }
    await db.users.insert_one(doc)
    token = create_access_token({"sub": doc["_id"], "email": doc["email"]})
    resp = Response(content="{}", media_type="application/json")
    resp.set_cookie(
        "access_token",
        token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return resp


@router.post("/login")
async def login(payload: UserLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user["_id"], "email": user["email"]})
    resp = Response(content="{}", media_type="application/json")
    resp.set_cookie(
        "access_token",
        token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return resp


async def _get_current_user(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    data = decode_token(token)
    uid = data.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = await db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/me")
async def me(user = Depends(_get_current_user)):
    return to_public(user)


@router.post("/logout")
async def logout():
    resp = Response(content="{}", media_type="application/json")
    resp.delete_cookie("access_token", path="/")
    return resp


# Expose dependency for other routers
get_current_user = _get_current_user

