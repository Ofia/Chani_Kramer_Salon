from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.models import Customer, User, PosSale, WigOrder
from app.schemas.schemas import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerHistoryResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = Query(None, description="Search by name or phone"),
    limit: Optional[int] = Query(None, description="Max results to return"),
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
    q = q.order_by(Customer.last_name)
    if limit:
        q = q.limit(limit)
    return q.all()


@router.get("/{customer_id}/history", response_model=CustomerHistoryResponse)
def get_customer_history(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    All purchases for a customer:
    - POS sales (visits recorded via the Point of Sale)
    - Direct wig orders (entered via Wig Orders page, not through a POS sale)

    Wig orders that originated from a POS sale are excluded from direct_wig_orders
    to avoid showing the same wig twice.
    """
    # All POS sales for this customer, newest first
    pos_sales = (
        db.query(PosSale)
        .filter(PosSale.customer_id == customer_id)
        .order_by(PosSale.sale_date.desc(), PosSale.created_at.desc())
        .all()
    )

    # Collect wig_order_ids that were created via POS — don't show them again
    pos_wig_ids = {
        item.wig_order_id
        for sale in pos_sales
        for item in sale.items
        if item.wig_order_id is not None
    }

    # Wig orders for this customer that were NOT from a POS sale
    all_wig_orders = (
        db.query(WigOrder)
        .filter(WigOrder.customer_id == customer_id)
        .order_by(WigOrder.order_date.desc())
        .all()
    )
    direct_wig_orders = [w for w in all_wig_orders if w.id not in pos_wig_ids]

    return CustomerHistoryResponse(
        pos_sales=pos_sales,
        direct_wig_orders=direct_wig_orders,
    )


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
