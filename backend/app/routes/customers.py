from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.models import Customer, User
from app.schemas.schemas import CustomerCreate, CustomerUpdate, CustomerResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = Query(None, description="Search by name or phone"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Customer)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                Customer.first_name.ilike(term),
                Customer.last_name.ilike(term),
                Customer.phone.ilike(term),
                Customer.cell.ilike(term),
            )
        )
    return q.order_by(Customer.last_name).all()


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


@router.post("/", response_model=CustomerResponse, status_code=201)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)

    db.commit()
    db.refresh(c)
    return c
