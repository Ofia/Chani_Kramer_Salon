"""
Database connection — SQLAlchemy + PostgreSQL (Railway).

Pseudo-code:
  engine = connect to postgres
  SessionLocal = a factory that makes DB sessions
  get_db() = a FastAPI dependency that opens a session, yields it, then closes it
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session, always closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
