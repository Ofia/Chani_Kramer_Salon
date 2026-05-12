from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import WeeklyPayroll, Employee, User
from app.schemas.schemas import PayrollCreate, PayrollUpdate, PayrollResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/payroll", tags=["payroll"])


@router.get("/", response_model=List[PayrollResponse])
def list_payroll(
    week_start: Optional[date] = Query(None),
    employee_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(WeeklyPayroll)
    if week_start:
        q = q.filter(WeeklyPayroll.week_start == week_start)
    if employee_id:
        q = q.filter(WeeklyPayroll.employee_id == employee_id)
    return q.order_by(WeeklyPayroll.week_start.desc()).all()


@router.get("/week/{week_start}", response_model=List[PayrollResponse])
def get_week_payroll(
    week_start: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all payroll entries for a specific week."""
    return (
        db.query(WeeklyPayroll)
        .filter(WeeklyPayroll.week_start == week_start)
        .all()
    )


@router.post("/", response_model=PayrollResponse, status_code=201)
def create_payroll_entry(
    data: PayrollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify employee exists
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check for duplicate
    existing = (
        db.query(WeeklyPayroll)
        .filter(
            WeeklyPayroll.week_start == data.week_start,
            WeeklyPayroll.employee_id == data.employee_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Payroll entry already exists for this employee this week")

    entry = WeeklyPayroll(**data.model_dump(), entered_by=current_user.id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{payroll_id}", response_model=PayrollResponse)
def update_payroll_entry(
    payroll_id: UUID,
    data: PayrollUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(WeeklyPayroll).filter(WeeklyPayroll.id == payroll_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Payroll entry not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{payroll_id}", status_code=204)
def delete_payroll_entry(
    payroll_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(WeeklyPayroll).filter(WeeklyPayroll.id == payroll_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Payroll entry not found")
    db.delete(entry)
    db.commit()
