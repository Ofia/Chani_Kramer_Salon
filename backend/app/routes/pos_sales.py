"""
POS Sales — multi-item cart per customer visit.

Each POST creates:
  - one PosSale (the visit header)
  - one or more PosSaleItems (line items)
  - one or more PosSalePayments (how they paid — supports split)
  - for wig items: also creates a WigOrder and links it back

GET /pos-sales/auto-fill/{date} aggregates today's POS data
for Daily Entry pre-population.
"""

from datetime import date
from decimal import Decimal
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    PosSale, PosSaleItem, PosSalePayment,
    WigOrder, WigPayment, InventoryItem,
    PosItemType, WigStatus, WigPaymentType, PaymentMethod, User,
)
from app.schemas.schemas import (
    PosSaleCreate, PosSaleResponse, DailyAutoFillResponse,
)
from app.core.security import get_current_user

router = APIRouter(prefix="/pos-sales", tags=["pos sales"])


# ── Create ────────────────────────────────────────────────────

@router.post("/", response_model=PosSaleResponse, status_code=201)
def create_pos_sale(
    data: PosSaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Compute totals
    total = sum(item.subtotal for item in data.items)
    paid  = sum(p.amount for p in data.payments)

    # 2. Create the sale header
    sale = PosSale(
        customer_id    = data.customer_id,
        customer_name  = data.customer_name,
        customer_phone = data.customer_phone,
        sale_date      = data.sale_date,
        notes          = data.notes,
        total_amount   = total,
        amount_paid    = paid,
        entered_by     = current_user.id,
    )
    db.add(sale)
    db.flush()  # gives us sale.id

    # 3. Process each line item
    for item_data in data.items:
        item = PosSaleItem(
            pos_sale_id       = sale.id,
            item_type         = item_data.item_type,
            description       = item_data.description,
            quantity          = item_data.quantity,
            unit_price        = item_data.unit_price,
            subtotal          = item_data.subtotal,
            inventory_item_id = item_data.inventory_item_id,
            wig_serial        = item_data.wig_serial,
            wig_brand         = item_data.wig_brand,
            wig_length        = item_data.wig_length,
            wig_color         = item_data.wig_color,
            wig_size          = item_data.wig_size,
            wig_front         = item_data.wig_front,
        )

        # For inventory items: decrement stock quantity
        if item_data.inventory_item_id:
            inv = db.query(InventoryItem).filter(
                InventoryItem.id == item_data.inventory_item_id
            ).first()
            if inv and inv.quantity >= item_data.quantity:
                inv.quantity -= item_data.quantity

        # For wig items: create a WigOrder record
        if item_data.item_type == PosItemType.wig:
            deposit_amt = item_data.wig_deposit_amount or Decimal(0)
            # Determine status — paid in full if deposit >= price
            if deposit_amt >= item_data.subtotal and item_data.subtotal > 0:
                wig_status   = WigStatus.paid_in_full
                pickup_date  = data.sale_date
            else:
                wig_status   = WigStatus.ordered
                pickup_date  = None

            wig = WigOrder(
                customer_name  = data.customer_name,
                customer_phone = data.customer_phone,
                customer_id    = data.customer_id,
                daysmart_serial = item_data.wig_serial,
                brand          = item_data.wig_brand,
                length         = item_data.wig_length,
                color          = item_data.wig_color,
                size           = item_data.wig_size,
                front          = item_data.wig_front,
                base_price     = item_data.subtotal,
                fill_lace_price = Decimal(0),
                total_price    = item_data.subtotal,
                amount_paid    = deposit_amt,
                status         = wig_status,
                order_date     = data.sale_date,
                pickup_date    = pickup_date,
                entered_by     = current_user.id,
            )
            db.add(wig)
            db.flush()

            # Record the deposit as a WigPayment
            if deposit_amt > 0:
                pay_type = WigPaymentType.final if wig_status == WigStatus.paid_in_full else WigPaymentType.deposit
                method   = item_data.wig_deposit_method or PaymentMethod.cash
                wig_pmt  = WigPayment(
                    wig_order_id   = wig.id,
                    payment_date   = data.sale_date,
                    amount         = deposit_amt,
                    payment_method = method,
                    payment_type   = pay_type,
                )
                db.add(wig_pmt)

            item.wig_order_id = wig.id

        db.add(item)

    # 4. Record payments
    for pmt_data in data.payments:
        pmt = PosSalePayment(
            pos_sale_id    = sale.id,
            payment_method = pmt_data.payment_method,
            amount         = pmt_data.amount,
        )
        db.add(pmt)

    db.commit()
    db.refresh(sale)
    return sale


# ── List by date ──────────────────────────────────────────────

@router.get("/date/{sale_date}", response_model=List[PosSaleResponse])
def list_pos_sales_by_date(
    sale_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(PosSale)
        .filter(PosSale.sale_date == sale_date)
        .order_by(PosSale.created_at.desc())
        .all()
    )


# ── Auto-fill for Daily Entry ─────────────────────────────────

@router.get("/auto-fill/{target_date}", response_model=DailyAutoFillResponse)
def auto_fill(
    target_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate all POS sales on target_date into the shape
    that DailySummary expects. The frontend uses this to
    pre-populate Tzipora's daily entry form.
    """
    sales = (
        db.query(PosSale)
        .filter(PosSale.sale_date == target_date)
        .all()
    )

    result = DailyAutoFillResponse(pos_sale_count=len(sales))

    for sale in sales:
        # Line item totals
        for item in sale.items:
            amt = float(item.subtotal)
            if item.item_type == PosItemType.wash_set:
                result.total_wash_set += amt
            elif item.item_type == PosItemType.repair:
                result.total_repairs += amt
            elif item.item_type == PosItemType.inventory:
                result.total_other += amt
            elif item.item_type == PosItemType.wig:
                result.new_wigs_sold += 1
                # Only count what was actually received as a deposit.
                # Revenue ($4,000) is NOT recognized until status = paid_in_full —
                # that's handled separately by the wig_orders query in Daily Entry.
                if item.wig_order_id:
                    wig = db.query(WigOrder).filter(WigOrder.id == item.wig_order_id).first()
                    if wig and wig.status != WigStatus.paid_in_full:
                        # Partial deposit — only the amount actually collected
                        result.wig_deposits_total += float(wig.amount_paid)
                    # If paid_in_full, revenue is already captured via wig_orders in the UI

        # Payment method breakdown
        for pmt in sale.payments:
            amt = float(pmt.amount)
            if pmt.payment_method == PaymentMethod.cash:
                result.cash_collected += amt
            elif pmt.payment_method == PaymentMethod.credit_card:
                result.cc_collected += amt
            elif pmt.payment_method == PaymentMethod.quickpay:
                result.quickpay_collected += amt
            elif pmt.payment_method == PaymentMethod.check:
                result.check_collected += amt
            elif pmt.payment_method == PaymentMethod.zelle:
                result.zelle_collected += amt

    return result


# ── Get one ───────────────────────────────────────────────────

@router.get("/{sale_id}", response_model=PosSaleResponse)
def get_pos_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = db.query(PosSale).filter(PosSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="POS sale not found")
    return sale


# ── Delete ────────────────────────────────────────────────────

@router.delete("/{sale_id}", status_code=204)
def delete_pos_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = db.query(PosSale).filter(PosSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="POS sale not found")
    db.delete(sale)
    db.commit()
