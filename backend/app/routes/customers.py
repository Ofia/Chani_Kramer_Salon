from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from sqlalchemy import func
from app.models.models import Customer, User, PosSale, PosSaleItem, InventoryItem, InventoryItemType, PosItemType, WigPayment
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
    - Wig sales (inventory wigs sold directly to this customer)
    """
    pos_sales = (
        db.query(PosSale)
        .filter(PosSale.customer_id == customer_id)
        .order_by(PosSale.sale_date.desc(), PosSale.created_at.desc())
        .all()
    )

    # Exclude wigs already shown as a line item inside a POS sale above —
    # otherwise the same transaction appears twice (once as POS Sale, once as Wig Order).
    pos_wig_ids = (
        db.query(PosSaleItem.inventory_item_id)
        .join(PosSale, PosSaleItem.pos_sale_id == PosSale.id)
        .filter(
            PosSale.customer_id == customer_id,
            PosSaleItem.item_type == PosItemType.wig,
            PosSaleItem.inventory_item_id.isnot(None),
        )
    )

    wig_sales = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.customer_id == customer_id,
            InventoryItem.item_type == InventoryItemType.wig,
            InventoryItem.sale_status.isnot(None),
            ~InventoryItem.id.in_(pos_wig_ids),
        )
        .order_by(InventoryItem.order_date.desc())
        .all()
    )

    # For wigs in wig_sales, some payments may have been made via a POS sale
    # (wig_balance_payments). Those amounts already appear in pos_sales.amount_paid,
    # so the frontend needs to subtract them to avoid double-counting.
    wig_sale_ids = [w.id for w in wig_sales]
    wig_pos_payments_total = 0.0
    if wig_sale_ids:
        result = db.query(func.sum(WigPayment.amount)).filter(
            WigPayment.inventory_item_id.in_(wig_sale_ids),
            WigPayment.pos_sale_id.isnot(None),
        ).scalar()
        wig_pos_payments_total = float(result or 0)

    return CustomerHistoryResponse(
        pos_sales=pos_sales,
        wig_sales=wig_sales,
        wig_pos_payments_total=wig_pos_payments_total,
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


@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(c)
    db.commit()
