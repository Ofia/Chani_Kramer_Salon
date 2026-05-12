from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.models import SaleTransaction, TransactionPayment, User, DataSource
from app.schemas.schemas import (
    TransactionCreate, TransactionUpdate, TransactionResponse, PaymentCreate, PaymentResponse
)
from app.core.security import get_current_user

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/", response_model=List[TransactionResponse])
def list_transactions(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(SaleTransaction).options(joinedload(SaleTransaction.payments))
    if start_date:
        q = q.filter(SaleTransaction.transaction_date >= start_date)
    if end_date:
        q = q.filter(SaleTransaction.transaction_date <= end_date)
    if customer_id:
        q = q.filter(SaleTransaction.customer_id == customer_id)
    return q.order_by(SaleTransaction.transaction_date.desc()).all()


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = (
        db.query(SaleTransaction)
        .options(joinedload(SaleTransaction.payments))
        .filter(SaleTransaction.id == transaction_id)
        .first()
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


@router.post("/", response_model=TransactionResponse, status_code=201)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payments_data = data.payments or []
    txn_data = data.model_dump(exclude={"payments"})

    txn = SaleTransaction(**txn_data, entered_by=current_user.id, source=DataSource.manual)
    db.add(txn)
    db.flush()  # get the ID before adding payments

    for p in payments_data:
        payment = TransactionPayment(**p.model_dump(), transaction_id=txn.id)
        db.add(payment)

        # keep amount_paid in sync
        txn.amount_paid = (txn.amount_paid or 0) + p.amount

    db.commit()
    db.refresh(txn)
    return txn


@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: UUID,
    data: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = db.query(SaleTransaction).filter(SaleTransaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(txn, field, value)

    db.commit()
    db.refresh(txn)
    return txn


@router.post("/{transaction_id}/payments", response_model=PaymentResponse, status_code=201)
def add_payment(
    transaction_id: UUID,
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new installment payment to an existing transaction."""
    txn = db.query(SaleTransaction).filter(SaleTransaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    payment = TransactionPayment(**data.model_dump(), transaction_id=transaction_id)
    db.add(payment)

    txn.amount_paid = (txn.amount_paid or 0) + data.amount

    db.commit()
    db.refresh(payment)
    return payment
