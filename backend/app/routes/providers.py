"""
Providers — wig companies, repair staff, colorists.

Routes:
  GET    /providers/           list all (optional filter by type, active_only)
  POST   /providers/           create a provider
  GET    /providers/{id}       get single provider
  PATCH  /providers/{id}       update provider fields
  DELETE /providers/{id}       delete provider
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Provider, ProviderType, UserRole, User
from app.schemas.schemas import ProviderCreate, ProviderUpdate, ProviderResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/providers", tags=["providers"])


def _require_bookkeeper_or_owner(current_user: User):
    if current_user.role not in (UserRole.bookkeeper, UserRole.owner):
        raise HTTPException(status_code=403, detail="Bookkeeper or owner role required")


@router.get("/", response_model=List[ProviderResponse])
def list_providers(
    provider_type: Optional[ProviderType] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_bookkeeper_or_owner(current_user)
    q = db.query(Provider)
    if provider_type:
        q = q.filter(Provider.provider_type == provider_type)
    if active_only:
        q = q.filter(Provider.is_active == True)
    return q.order_by(Provider.name).all()


@router.post("/", response_model=ProviderResponse, status_code=201)
def create_provider(
    body: ProviderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_bookkeeper_or_owner(current_user)
    provider = Provider(**body.model_dump())
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


@router.get("/{provider_id}", response_model=ProviderResponse)
def get_provider(
    provider_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_bookkeeper_or_owner(current_user)
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    return p


@router.patch("/{provider_id}", response_model=ProviderResponse)
def update_provider(
    provider_id: UUID,
    body: ProviderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_bookkeeper_or_owner(current_user)
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{provider_id}", status_code=204)
def delete_provider(
    provider_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_bookkeeper_or_owner(current_user)
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    db.delete(p)
    db.commit()
