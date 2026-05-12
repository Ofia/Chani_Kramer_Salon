from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Deposit, User
from app.schemas.schemas import DepositCreate, DepositUpdate, DepositResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/deposits", tags=["deposits"])


@router.get("/", response_model=List[DepositResponse])
def list_deposits(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Deposit)
    if start_date:
        q = q.filter(Deposit.deposit_date >= start_date)
    if end_date:
        q = q.filter(Deposit.deposit_date <= end_date)
    return q.order_by(Deposit.deposit_date.desc()).all()


@router.get("/{deposit_date}", response_model=DepositResponse)
def get_deposit(
    deposit_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.query(Deposit).filter(Deposit.deposit_date == deposit_date).first()
    if not d:
        raise HTTPException(status_code=404, detail="No deposit record for this date")
    return d


@router.post("/", response_model=DepositResponse, status_code=201)
def create_deposit(
    data: DepositCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Deposit).filter(Deposit.deposit_date == data.deposit_date).first()
    if existing:
        raise HTTPException(status_code=409, detail="Deposit record for this date already exists. Use PATCH.")

    deposit = Deposit(**data.model_dump(), entered_by=current_user.id)
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return deposit


@router.patch("/{deposit_date}", response_model=DepositResponse)
def update_deposit(
    deposit_date: date,
    data: DepositUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.query(Deposit).filter(Deposit.deposit_date == deposit_date).first()
    if not d:
        raise HTTPException(status_code=404, detail="Deposit record not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(d, field, value)

    db.commit()
    db.refresh(d)
    return d
