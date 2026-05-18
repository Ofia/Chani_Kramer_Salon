from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Employee, User
from app.schemas.schemas import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from app.core.security import get_current_user, require_owner

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/", response_model=List[EmployeeResponse])
def list_employees(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Employee)
    if active_only:
        q = q.filter(Employee.is_active == True)
    return q.order_by(Employee.last_name).all()


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.post("/", response_model=EmployeeResponse, status_code=201)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp = Employee(**data.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.patch("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: UUID,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(emp, field, value)

    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{employee_id}", status_code=204)
def deactivate_employee(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Soft delete — sets is_active=False instead of deleting."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.is_active = False
    db.commit()
