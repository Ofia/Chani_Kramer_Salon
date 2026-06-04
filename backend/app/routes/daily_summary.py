from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import DailySummary, User
from app.schemas.schemas import DailySummaryCreate, DailySummaryUpdate, DailySummaryResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/daily-summary", tags=["daily summary"])


@router.get("/", response_model=List[DailySummaryResponse])
def list_summaries(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(DailySummary)
    if start_date:
        q = q.filter(DailySummary.summary_date >= start_date)
    if end_date:
        q = q.filter(DailySummary.summary_date <= end_date)
    return q.order_by(DailySummary.summary_date.desc()).all()


@router.get("/{summary_date}", response_model=DailySummaryResponse)
def get_summary(
    summary_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(DailySummary).filter(DailySummary.summary_date == summary_date).first()
    if not s:
        raise HTTPException(status_code=404, detail="No summary for this date")
    return s


@router.post("/", response_model=DailySummaryResponse, status_code=201)
def create_summary(
    data: DailySummaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(DailySummary).filter(DailySummary.summary_date == data.summary_date).first()
    if existing:
        raise HTTPException(status_code=409, detail="Summary for this date already exists. Use PATCH to update.")

    summary = DailySummary(**data.model_dump(), entered_by=current_user.id)
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary


@router.patch("/{summary_date}", response_model=DailySummaryResponse)
def update_summary(
    summary_date: date,
    data: DailySummaryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(DailySummary).filter(DailySummary.summary_date == summary_date).first()
    if not s:
        raise HTTPException(status_code=404, detail="Summary not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(s, field, value)

    db.commit()
    db.refresh(s)
    return s


@router.post("/{summary_date}/lock", response_model=DailySummaryResponse)
def lock_summary(
    summary_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lock a day — marks it as finalized. Triggers financial snapshot computation."""
    s = db.query(DailySummary).filter(DailySummary.summary_date == summary_date).first()
    if not s:
        raise HTTPException(status_code=404, detail="Summary not found")

    s.is_locked = True
    db.commit()
    db.refresh(s)
    return s
