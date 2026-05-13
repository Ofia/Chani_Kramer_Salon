"""
Auth middleware — validates Supabase JWT tokens (ES256 via JWKS).

How it works:
- Supabase signs user JWTs with an EC (P-256) key
- We fetch the public key once from the JWKS endpoint at startup
- Every request: decode the Bearer token using that public key
- Extract the Supabase UID (sub), look up the user in our DB
"""

import httpx
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.models.models import User

bearer_scheme = HTTPBearer(auto_error=False)

JWKS_URL = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"


@lru_cache(maxsize=1)
def get_jwks() -> dict:
    """Fetch and cache the JWKS public key from Supabase (called once)."""
    response = httpx.get(JWKS_URL, timeout=10)
    response.raise_for_status()
    return response.json()


def decode_supabase_token(token: str) -> dict:
    """Decode and verify a Supabase JWT using the JWKS public key."""
    jwks = get_jwks()
    try:
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["ES256", "HS256"],  # support both current and legacy keys
            options={"verify_aud": False},
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency: extract the current user from the JWT.
    Usage: add `current_user: User = Depends(get_current_user)` to any route.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_supabase_token(credentials.credentials)
    supabase_uid = payload.get("sub")

    if not supabase_uid:
        raise HTTPException(status_code=401, detail="Token missing subject")

    user = db.query(User).filter(User.supabase_uid == supabase_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in system")

    return user


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: only owner role can access this route."""
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required",
        )
    return current_user


def require_bookkeeper_or_owner(current_user: User = Depends(get_current_user)) -> User:
    """Both bookkeeper and owner can access."""
    return current_user
