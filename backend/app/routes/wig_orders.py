"""
Wig Orders — one row per physical wig sold.

A wig lives in the business for weeks or months while being prepared.
Revenue is recognized only when status = paid_in_full.
Deposits are cash tracking only — not revenue.
"""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import WigOrder, WigPayment, WigStatus, WigPaymentType, User
from app.schemas.schemas import (
    WigOrderCreate, WigOrderUpdate, WigOrderResponse,
    WigPaymentCreate, WigPaymentResponse,
)
from app.core.security import get_current_user

router = APIRouter(prefix="/wig-orders", tags=["wig orders"])


# ── List ──────────────────────────────────────────────────────

@router.get("/", response_model=List[WigOrderResponse])
def list_wig_orders(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status: Optional[WigStatus] = Query(None),
    customer_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(WigOrder)
    if start_date:
        q = q.filter(WigOrder.order_date >= start_date)
    if end_date:
        q = q.filter(WigOrder.order_date <= end_date)
    if status:
        q = q.filter(WigOrder.status == status)
    if customer_name:
        q = q.filter(WigOrder.customer_name.ilike(f"%{customer_name}%"))
    return q.order_by(WigOrder.order_date.desc()).all()


@router.get("/date/{order_date}", response_model=List[WigOrderResponse])
def list_wig_orders_by_date(
    order_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All wig orders placed on a specific date."""
    return db.query(WigOrder).filter(WigOrder.order_date == order_date).all()


@router.get("/search", response_model=List[WigOrderResponse])
def search_wig_orders(
    serial: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search by DaySmart serial or customer name."""
    q = db.query(WigOrder)
    if serial:
        q = q.filter(WigOrder.daysmart_serial.ilike(f"%{serial}%"))
    if customer:
        q = q.filter(WigOrder.customer_name.ilike(f"%{customer}%"))
    return q.order_by(WigOrder.order_date.desc()).limit(20).all()


# ── Get one ───────────────────────────────────────────────────

@router.get("/{wig_id}", response_model=WigOrderResponse)
def get_wig_order(
    wig_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wig = db.query(WigOrder).filter(WigOrder.id == wig_id).first()
    if not wig:
        raise HTTPException(status_code=404, detail="Wig order not found")
    return wig


# ── Create ────────────────────────────────────────────────────

@router.post("/", response_model=WigOrderResponse, status_code=201)
def create_wig_order(
    data: WigOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump(exclude={"initial_payment"})
    wig = WigOrder(**payload, entered_by=current_user.id)
    db.add(wig)
    db.flush()  # get wig.id without committing

    if data.initial_payment:
        payment = WigPayment(
            wig_order_id=wig.id,
            **data.initial_payment.model_dump(),
        )
        db.add(payment)
        wig.amount_paid = data.initial_payment.amount
        # If deposit is the full price, mark as paid in full immediately
        if wig.amount_paid >= wig.total_price and wig.total_price > 0:
            wig.status = WigStatus.paid_in_full
            wig.pickup_date = data.initial_payment.payment_date

    db.commit()
    db.refresh(wig)
    return wig


# ── Update ────────────────────────────────────────────────────

@router.patch("/{wig_id}", response_model=WigOrderResponse)
def update_wig_order(
    wig_id: UUID,
    data: WigOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wig = db.query(WigOrder).filter(WigOrder.id == wig_id).first()
    if not wig:
        raise HTTPException(status_code=404, detail="Wig order not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(wig, field, value)

    db.commit()
    db.refresh(wig)
    return wig


# ── Add Payment ───────────────────────────────────────────────

@router.post("/{wig_id}/payments", response_model=WigOrderResponse)
def add_payment(
    wig_id: UUID,
    data: WigPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record a payment against a wig order.
    If amount_paid reaches total_price, status auto-advances to paid_in_full.
    """
    wig = db.query(WigOrder).filter(WigOrder.id == wig_id).first()
    if not wig:
        raise HTTPException(status_code=404, detail="Wig order not found")
    if wig.status == WigStatus.paid_in_full:
        raise HTTPException(status_code=400, detail="Wig is already paid in full")

    payment = WigPayment(wig_order_id=wig.id, **data.model_dump())
    db.add(payment)

    wig.amount_paid = (wig.amount_paid or Decimal(0)) + data.amount

    if wig.amount_paid >= wig.total_price and wig.total_price > 0:
        wig.status = WigStatus.paid_in_full
        wig.pickup_date = data.payment_date
        # Override payment_type to final on this payment
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
    wig = db.query(WigOrder).filter(WigOrder.id == wig_id).first()
    if not wig:
        raise HTTPException(status_code=404, detail="Wig order not found")
    db.delete(wig)
    db.commit()


# ── Mark Ready ────────────────────────────────────────────────

@router.post("/{wig_id}/mark-ready", response_model=WigOrderResponse)
def mark_ready(
    wig_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a wig as arrived and ready for pickup."""
    wig = db.query(WigOrder).filter(WigOrder.id == wig_id).first()
    if not wig:
        raise HTTPException(status_code=404, detail="Wig order not found")
    wig.status = WigStatus.ready
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
