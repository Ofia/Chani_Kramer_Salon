from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import StaffCheckin, User
from app.schemas.schemas import CheckinResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/checkins", tags=["checkins"])


@router.get("/today", response_model=List[CheckinResponse])
def get_today_checkins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    checkins = db.query(StaffCheckin).filter(StaffCheckin.date == today).all()
    return [
        CheckinResponse(
            id=c.id,
            user_id=c.user_id,
            user_name=c.user.name if c.user else "Unknown",
            date=c.date,
            checked_in_at=c.checked_in_at,
        )
        for c in checkins
    ]


@router.post("/", response_model=CheckinResponse, status_code=201)
def check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    existing = db.query(StaffCheckin).filter(
        StaffCheckin.user_id == current_user.id,
        StaffCheckin.date == today,
    ).first()
    if existing:
        # Already checked in — return existing row (idempotent)
        return CheckinResponse(
            id=existing.id,
            user_id=existing.user_id,
            user_name=current_user.name,
            date=existing.date,
            checked_in_at=existing.checked_in_at,
        )
    checkin = StaffCheckin(user_id=current_user.id)
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return CheckinResponse(
        id=checkin.id,
        user_id=checkin.user_id,
        user_name=current_user.name,
        date=checkin.date,
        checked_in_at=checkin.checked_in_at,
    )


@router.delete("/today", status_code=204)
def check_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    checkin = db.query(StaffCheckin).filter(
        StaffCheckin.user_id == current_user.id,
        StaffCheckin.date == today,
    ).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Not checked in today")
    db.delete(checkin)
    db.commit()
