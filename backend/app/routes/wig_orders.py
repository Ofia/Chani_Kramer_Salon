"""
Wig Orders — wig sale lifecycle on top of inventory_items.

After Migration 011, there is no wig_orders table.
A wig sale IS an inventory_item with item_type='wig' and a sale_status set.

Revenue is recognized only when sale_status = paid_in_full.
Deposits are cash tracking only — not revenue.
"""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    InventoryItem, InventoryItemType, WigPayment,
    WigStatus, WigPaymentType, User,
)
from app.schemas.schemas import (
    WigSaleCreate, WigSaleUpdate,
    InventoryItemResponse,
    WigPaymentCreate, WigPaymentResponse,
)
from app.core.security import get_current_user

router = APIRouter(prefix="/wig-orders", tags=["wig orders"])

# Helper: base query for wig sale items (wigs that have a sale_status)
def _wig_sales_q(db: Session):
    return (
        db.query(InventoryItem)
        .filter(
            InventoryItem.item_type == InventoryItemType.wig,
            InventoryItem.sale_status.isnot(None),
        )
    )


# ── List ──────────────────────────────────────────────────────

@router.get("/", response_model=List[InventoryItemResponse])
def list_wig_orders(
    start_date:    Optional[date]      = Query(None),
    end_date:      Optional[date]      = Query(None),
    status:        Optional[WigStatus] = Query(None),
    customer_name: Optional[str]       = Query(None),
    customer_id:   Optional[UUID]      = Query(None),
    pickup_date:   Optional[date]      = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = _wig_sales_q(db)
    if start_date:
        q = q.filter(InventoryItem.order_date >= start_date)
    if end_date:
        q = q.filter(InventoryItem.order_date <= end_date)
    if status:
        q = q.filter(InventoryItem.sale_status == status)
    if customer_name:
        q = q.filter(InventoryItem.customer_name.ilike(f"%{customer_name}%"))
    if customer_id:
        q = q.filter(InventoryItem.customer_id == customer_id)
    if pickup_date:
        q = q.filter(InventoryItem.pickup_date == pickup_date)
    return q.order_by(InventoryItem.order_date.desc()).all()


@router.get("/date/{order_date}", response_model=List[InventoryItemResponse])
def list_wig_orders_by_date(
    order_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All wig sales placed on a specific date."""
    return (
        _wig_sales_q(db)
        .filter(InventoryItem.order_date == order_date)
        .all()
    )


@router.get("/search", response_model=List[InventoryItemResponse])
def search_wig_orders(
    serial:   Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search by DaySmart serial or customer name."""
    q = _wig_sales_q(db)
    if serial:
        q = q.filter(InventoryItem.daysmart_serial.ilike(f"%{serial}%"))
    if customer:
        q = q.filter(InventoryItem.customer_name.ilike(f"%{customer}%"))
    return q.order_by(InventoryItem.order_date.desc()).limit(20).all()


# ── Get one ───────────────────────────────────────────────────

@router.get("/{wig_id}", response_model=InventoryItemResponse)
def get_wig_order(
    wig_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wig = _wig_sales_q(db).filter(InventoryItem.id == wig_id).first()
    if not wig:
        raise HTTPException(status_code=404, detail="Wig order not found")
    return wig


# ── Create ────────────────────────────────────────────────────

@router.post("/", response_model=InventoryItemResponse, status_code=201)
def create_wig_order(
    data: WigSaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a wig sale.
    - If inventory_item_id is provided, attach the sale to that existing wig.
    - Otherwise create a new inventory item (wig) and attach the sale.
    """
    if data.inventory_item_id:
        wig = db.query(InventoryItem).filter(
            InventoryItem.id == data.inventory_item_id,
            InventoryItem.item_type == InventoryItemType.wig,
        ).first()
        if not wig:
            raise HTTPException(status_code=404, detail="Inventory wig not found")
        if wig.sale_status is not None:
            raise HTTPException(status_code=400, detail="Wig is already sold")
    else:
        # Build auto name from brand + serial
        serial = data.daysmart_serial or ""
        brand  = data.brand or ""
        auto_name = f"{brand} {serial}".strip() or f"{data.customer_name}'s Wig"
        wig = InventoryItem(
            item_type       = InventoryItemType.wig,
            name            = auto_name,
            daysmart_serial = data.daysmart_serial,
            daysmart_receipt_no = data.daysmart_receipt_no,
            brand           = data.brand,
            length          = data.length,
            color           = data.color,
            size            = data.size,
            front           = data.front,
            created_by      = current_user.id,
        )
        db.add(wig)
        db.flush()

    # Attach sale data
    wig.customer_name       = data.customer_name
    wig.customer_phone      = data.customer_phone
    wig.customer_id         = data.customer_id
    wig.total_price         = data.total_price
    wig.amount_paid         = Decimal("0")
    wig.sale_status         = WigStatus.ordered
    wig.order_date          = data.order_date
    wig.additional_charges  = [c.model_dump() for c in data.additional_charges]
    if data.notes:
        wig.notes = data.notes

    db.flush()

    if data.initial_payment:
        payment = WigPayment(
            inventory_item_id=wig.id,
            **data.initial_payment.model_dump(),
        )
        db.add(payment)
        wig.amount_paid = data.initial_payment.amount
        if wig.amount_paid >= (wig.total_price + (wig.sale_tax_amount or Decimal(0))) and wig.total_price > 0:
            wig.sale_status = WigStatus.paid_in_full
            wig.pickup_date = data.initial_payment.payment_date
            payment.payment_type = WigPaymentType.final

    db.commit()
    db.refresh(wig)
    return wig


# ── Update ────────────────────────────────────────────────────

@router.patch("/{wig_id}", response_model=InventoryItemResponse)
def update_wig_order(
    wig_id: UUID,
    data: WigSaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wig = _wig_sales_q(db).filter(InventoryItem.id == wig_id).first()
    if not wig:
        raise HTTPException(status_code=404, detail="Wig order not found")

    updates = data.model_dump(exclude_unset=True)
    # additional_charges arrives as list of AdditionalCharge objects — convert to plain dicts
    if "additional_charges" in updates and updates["additional_charges"] is not None:
        updates["additional_charges"] = [
            c if isinstance(c, dict) else c.model_dump()
            for c in updates["additional_charges"]
        ]

    for field, value in updates.items():
        setattr(wig, field, value)

    db.commit()
    db.refresh(wig)
    return wig


# ── Add Payment ───────────────────────────────────────────────

@router.post("/{wig_id}/payments", response_model=InventoryItemResponse)
def add_payment(
    wig_id: UUID,
    data: WigPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record a payment against a wig sale.
    If amount_paid reaches total_price, sale_status auto-advances to paid_in_full.
    """
    wig = _wig_sales_q(db).filter(InventoryItem.id == wig_id).first()
    if not wig:
        raise HTTPException(status_code=404, detail="Wig order not found")
    if wig.sale_status == WigStatus.paid_in_full:
        raise HTTPException(status_code=400, detail="Wig is already paid in full")

    payment = WigPayment(inventory_item_id=wig.id, **data.model_dump())
    db.add(payment)

    wig.amount_paid = (wig.amount_paid or Decimal(0)) + data.amount

    if wig.amount_paid >= (wig.total_price + (wig.sale_tax_amount or Decimal(0))) and wig.total_price > 0:
        wig.sale_status = WigStatus.paid_in_full
        wig.pickup_date = data.payment_date
        payment.payment_type = WigPaymentType.final

    db.commit()
    db.refresh(wig)
    return wig


# ── Delete ───────────────────────────────────────────────────

@router.delete("/{wig_id}", status_code=204)
def delete_wig_order(
    wig_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wig = _wig_sales_q(db).filter(InventoryItem.id == wig_id).first()
    if not wig:
        raise HTTPException(status_code=404, detail="Wig order not found")
    # Clear sale fields instead of deleting the inventory item
    wig.customer_id         = None
    wig.customer_name       = None
    wig.customer_phone      = None
    wig.total_price         = None
    wig.amount_paid         = Decimal("0")
    wig.sale_status         = None
    wig.order_date          = None
    wig.pickup_date         = None
    wig.daysmart_receipt_no = None
    wig.additional_charges  = []
    db.commit()


# ── Mark Ready ────────────────────────────────────────────────

@router.post("/{wig_id}/mark-ready", response_model=InventoryItemResponse)
def mark_ready(
    wig_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a wig as arrived and ready for pickup."""
    wig = _wig_sales_q(db).filter(InventoryItem.id == wig_id).first()
    if not wig:
        raise HTTPException(status_code=404, detail="Wig order not found")
    wig.sale_status = WigStatus.ready
    db.commit()
    db.refresh(wig)
    return wig


# ── Payments on a date ────────────────────────────────────────

@router.get("/payments/date/{payment_date}", response_model=List[WigPaymentResponse])
def get_payments_by_date(
    payment_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All wig payments (deposits + finals) received on a given date."""
    return (
        db.query(WigPayment)
        .filter(WigPayment.payment_date == payment_date)
        .order_by(WigPayment.created_at)
        .all()
    )
