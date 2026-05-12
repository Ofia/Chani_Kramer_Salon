"""
Auth middleware — validates Supabase JWT tokens.

How it works:
- Supabase issues a JWT when a user logs in on the frontend
- The frontend sends that token in every request: Authorization: Bearer <token>
- We decode the token here, extract the user's Supabase UID
- Then look up the user in our own `users` table to get their role
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.models.models import User

bearer_scheme = HTTPBearer()


def decode_supabase_token(token: str) -> dict:
    """Decode and verify a Supabase JWT. Returns the payload dict."""
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
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
    payload = decode_supabase_token(credentials.credentials)
    supabase_uid = payload.get("sub")  # 'sub' = Supabase user ID

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
