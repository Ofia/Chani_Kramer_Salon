from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import ExpenseEntry, ExpenseCategory, User
from app.schemas.schemas import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("/", response_model=List[ExpenseResponse])
def list_expenses(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    category: Optional[ExpenseCategory] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ExpenseEntry)
    if start_date:
        q = q.filter(ExpenseEntry.expense_date >= start_date)
    if end_date:
        q = q.filter(ExpenseEntry.expense_date <= end_date)
    if category:
        q = q.filter(ExpenseEntry.category == category)
    return q.order_by(ExpenseEntry.expense_date.desc()).all()


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(ExpenseEntry).filter(ExpenseEntry.id == expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    return e


@router.post("/", response_model=ExpenseResponse, status_code=201)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = ExpenseEntry(**data.model_dump(), entered_by=current_user.id)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: UUID,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(ExpenseEntry).filter(ExpenseEntry.id == expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(e, field, value)

    db.commit()
    db.refresh(e)
    return e


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(ExpenseEntry).filter(ExpenseEntry.id == expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(e)
    db.commit()
