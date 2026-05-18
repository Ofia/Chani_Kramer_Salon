from datetime import date
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import CompanyNotification, User
from app.schemas.schemas import NotificationCreate, NotificationUpdate, NotificationResponse
from app.core.security import get_current_user, require_owner

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=List[NotificationResponse])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    return (
        db.query(CompanyNotification)
        .filter(
            or_(
                CompanyNotification.is_pinned == True,
                CompanyNotification.scheduled_date == None,
                CompanyNotification.scheduled_date >= today,
            )
        )
        .order_by(
            CompanyNotification.is_pinned.desc(),
            CompanyNotification.scheduled_date.asc(),
        )
        .all()
    )


@router.post("/", response_model=NotificationResponse, status_code=201)
def create_notification(
    data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    n = CompanyNotification(**data.model_dump(), created_by=current_user.id)
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


@router.patch("/{notif_id}", response_model=NotificationResponse)
def update_notification(
    notif_id: UUID,
    data: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    n = db.query(CompanyNotification).filter(CompanyNotification.id == notif_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(n, field, value)
    db.commit()
    db.refresh(n)
    return n


@router.delete("/{notif_id}", status_code=204)
def delete_notification(
    notif_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    n = db.query(CompanyNotification).filter(CompanyNotification.id == notif_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(n)
    db.commit()
