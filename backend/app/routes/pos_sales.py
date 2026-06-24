"""
POS Sales — multi-item cart per customer visit.

Each POST creates:
  - one PosSale (the visit header)
  - one or more PosSaleItems (line items)
  - one or more PosSalePayments (how they paid — supports split)
  - for wig items: updates the InventoryItem with sale data + creates a WigPayment

GET /pos-sales/auto-fill/{date} aggregates today's POS data
for Daily Entry pre-population.
"""

from datetime import date
from decimal import Decimal
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    PosSale, PosSaleItem, PosSalePayment,
    WigPayment, InventoryItem, InventoryItemType, InventoryEvent, InventoryEventType,
    PosItemType, WigStatus, WigItemStatus, WigPaymentType, PaymentMethod, User,
    DeletedSale, UserRole,
)
import json
import re as _re

from app.schemas.schemas import (
    PosSaleCreate, PosSaleResponse, DailyAutoFillResponse, WigBalancePaymentIn,
    PosBalancePaymentIn, DeleteSalePayload, DeletedSaleResponse,
    PosSaleItemEdit, PosSaleBulkEdit,
)

_POS_BAL_RE = _re.compile(r'__pos_bal__:(\[.*?\])(?:\n|$)', _re.DOTALL)
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
    #    tax_amount_override: custom dollar amount (used when frontend sets "custom" tax)
    #    tax_rate = 0          → tax exempt
    #    tax_rate = 0.045      → flat 4.5% on entire cart subtotal
    #    tax_rate = 0.08875    → flat 8.875% on entire cart subtotal
    wig_balance_total = sum(wbp.amount for wbp in data.wig_balance_payments)
    pos_balance_total = sum(pbp.amount for pbp in data.pos_balance_payments)
    items_subtotal_for_tax = sum(item.subtotal for item in data.items)

    if data.tax_amount_override is not None:
        tax_amount = data.tax_amount_override.quantize(Decimal("0.01"))
    elif data.tax_rate > 0:
        tax_amount = (items_subtotal_for_tax * data.tax_rate).quantize(Decimal("0.01"))
    else:
        tax_amount = Decimal("0")

    total = items_subtotal_for_tax + wig_balance_total + pos_balance_total + tax_amount + data.shipping_amount - data.discount_amount
    # paid = only what data.payments contains. The frontend auto-fill already sets the
    # payment to the full cart total (including wig/pos balance items), so we must NOT
    # add wig_balance_total or pos_balance_total here — that would double-count them.
    paid  = sum(p.amount for p in data.payments)

    # 2. Create the sale header
    sale = PosSale(
        customer_id      = data.customer_id,
        customer_name    = data.customer_name,
        customer_phone   = data.customer_phone,
        sale_date        = data.sale_date,
        notes            = data.notes,
        total_amount     = total,
        amount_paid      = paid,
        tax_rate         = data.tax_rate,
        tax_amount       = tax_amount,
        discount_amount  = data.discount_amount,
        shipping_amount  = data.shipping_amount,
        shipping_address = data.shipping_address,
        entered_by       = current_user.id,
    )
    db.add(sale)
    db.flush()  # gives us sale.id

    # If this checkout includes POS balance payments, embed a machine-readable
    # cross-reference in the sale's notes so the delete handler and customer
    # history endpoint can find and reverse/de-duplicate them later.
    if data.pos_balance_payments:
        refs = [{"sale_id": str(pbp.pos_sale_id), "amount": float(pbp.amount)}
                for pbp in data.pos_balance_payments]
        marker = f"__pos_bal__:{json.dumps(refs)}"
        sale.notes = marker + ("\n" + data.notes if data.notes else "")

    # 3. Process each line item
    for item_data in data.items:
        # Compute per-item tax amount
        item_tax = (item_data.subtotal * Decimal(str(item_data.tax_rate))).quantize(Decimal("0.01"))

        item = PosSaleItem(
            pos_sale_id       = sale.id,
            item_type         = item_data.item_type,
            description       = item_data.description,
            quantity          = item_data.quantity,
            unit_price        = item_data.unit_price,
            subtotal          = item_data.subtotal,
            tax_amount        = item_tax,
            inventory_item_id = item_data.inventory_item_id,
            notes             = item_data.notes,
            wig_serial        = item_data.wig_serial,
            wig_brand         = item_data.wig_brand,
            wig_length        = item_data.wig_length,
            wig_color         = item_data.wig_color,
            wig_size          = item_data.wig_size,
            wig_front         = item_data.wig_front,
            sales_rep_id      = item_data.sales_rep_id,
        )

        # For inventory items: decrement stock quantity (non-wig products)
        if item_data.inventory_item_id and item_data.item_type != PosItemType.wig:
            inv = db.query(InventoryItem).filter(
                InventoryItem.id == item_data.inventory_item_id
            ).first()
            if inv and inv.quantity >= item_data.quantity:
                inv.quantity -= item_data.quantity

        # For wig items: attach sale data to the InventoryItem + record deposit payment
        if item_data.item_type == PosItemType.wig and item_data.inventory_item_id:
            deposit_amt = item_data.wig_deposit_amount or Decimal(0)

            wig = db.query(InventoryItem).filter(
                InventoryItem.id == item_data.inventory_item_id,
                InventoryItem.item_type == InventoryItemType.wig,
            ).first()

            if wig:
                # Determine sale status — paid in full if deposit covers price + tax
                if deposit_amt >= (item_data.subtotal + item_tax) and item_data.subtotal > 0:
                    new_sale_status = WigStatus.paid_in_full
                    pickup_date     = data.sale_date
                else:
                    new_sale_status = WigStatus.ordered
                    pickup_date     = None

                wig.customer_name    = data.customer_name
                wig.customer_phone   = data.customer_phone
                wig.customer_id      = data.customer_id
                wig.total_price      = item_data.subtotal
                wig.amount_paid      = deposit_amt
                wig.sale_status      = new_sale_status
                wig.wig_status       = WigItemStatus.sold
                wig.order_date       = data.sale_date
                wig.pickup_date      = pickup_date
                # Lock the wig's tax obligation at sale time — recognized on pickup_date
                wig.sale_tax_amount  = item_tax

                if deposit_amt > 0:
                    pay_type = (
                        WigPaymentType.final
                        if new_sale_status == WigStatus.paid_in_full
                        else WigPaymentType.deposit
                    )
                    method = item_data.wig_deposit_method or PaymentMethod.cash
                    db.add(WigPayment(
                        inventory_item_id = wig.id,
                        pos_sale_id       = sale.id,   # link deposit to its sale for clean deletion
                        payment_date      = data.sale_date,
                        amount            = deposit_amt,
                        payment_method    = method,
                        payment_type      = pay_type,
                    ))

                # Log sale event in wig history
                if new_sale_status == WigStatus.paid_in_full:
                    sold_desc = f"Sold — paid in full ${item_data.subtotal:.2f} to {data.customer_name}"
                elif deposit_amt > 0:
                    sold_desc = f"Sold — deposit ${deposit_amt:.2f} of ${item_data.subtotal:.2f} to {data.customer_name}"
                else:
                    sold_desc = f"Sold — no deposit, total ${item_data.subtotal:.2f} to {data.customer_name}"
                db.add(InventoryEvent(
                    inventory_item_id = wig.id,
                    event_type        = InventoryEventType.sold,
                    customer_id       = data.customer_id,
                    pos_sale_id       = sale.id,
                    description       = sold_desc,
                    event_date        = data.sale_date,
                    created_by        = current_user.id,
                ))

        db.add(item)

        # For service items linked to a salon wig: log a 'service' event in the wig's history
        if (
            item_data.item_type in (PosItemType.wash_set, PosItemType.repair)
            and item_data.inventory_item_id
        ):
            db.add(InventoryEvent(
                inventory_item_id = item_data.inventory_item_id,
                event_type        = InventoryEventType.service,
                customer_id       = data.customer_id,
                pos_sale_id       = sale.id,
                description       = item_data.description,
                event_date        = data.sale_date,
                created_by        = current_user.id,
            ))

    # 4. Record cart payments
    for pmt_data in data.payments:
        pmt = PosSalePayment(
            pos_sale_id    = sale.id,
            payment_method = pmt_data.payment_method,
            amount         = pmt_data.amount,
        )
        db.add(pmt)

    # 5. Process wig balance payments (returning customer paying off existing orders).
    #    Each one: updates the InventoryItem sale fields, creates a WigPayment,
    #    and adds a PosSalePayment so it appears in daily panel and auto-fill.
    for wbp in data.wig_balance_payments:
        wig = db.query(InventoryItem).filter(
            InventoryItem.id == wbp.inventory_item_id,
            InventoryItem.item_type == InventoryItemType.wig,
        ).first()
        if not wig:
            continue

        balance  = (wig.total_price or Decimal(0)) + (wig.sale_tax_amount or Decimal(0)) - (wig.amount_paid or Decimal(0))
        pay_type = WigPaymentType.final if wbp.amount >= balance else WigPaymentType.partial

        db.add(WigPayment(
            inventory_item_id = wig.id,
            pos_sale_id       = sale.id,   # marks it as captured via POS
            payment_date      = data.sale_date,
            amount            = wbp.amount,
            payment_method    = wbp.payment_method,
            payment_type      = pay_type,
        ))

        wig.amount_paid = (wig.amount_paid or Decimal(0)) + wbp.amount
        if wig.total_price and wig.amount_paid >= (wig.total_price + (wig.sale_tax_amount or Decimal(0))):
            wig.sale_status = WigStatus.paid_in_full
            wig.pickup_date = data.sale_date

        # Log payment event in wig history
        if pay_type == WigPaymentType.final:
            pmt_desc = f"Paid in full — ${wbp.amount:.2f} received"
        else:
            remaining = max(Decimal(0), (wig.total_price or Decimal(0)) + (wig.sale_tax_amount or Decimal(0)) - wig.amount_paid)
            pmt_desc = f"Partial payment — ${wbp.amount:.2f} received, ${remaining:.2f} remaining"
        db.add(InventoryEvent(
            inventory_item_id = wig.id,
            event_type        = InventoryEventType.payment_received,
            customer_id       = data.customer_id,
            pos_sale_id       = sale.id,
            description       = pmt_desc,
            event_date        = data.sale_date,
            created_by        = current_user.id,
        ))

    # 6. Process POS sale balance payments (customer paying off an old product/service sale).
    #    Strategy: increment the original sale's amount_paid + add a PosSalePayment audit
    #    record to the original sale. The cross-reference is already stored in sale.notes above.
    for pbp in data.pos_balance_payments:
        original = db.query(PosSale).filter(PosSale.id == pbp.pos_sale_id).first()
        if not original:
            continue
        remaining = max(Decimal(0), (original.total_amount or Decimal(0)) - (original.amount_paid or Decimal(0)))
        pay_amount = min(pbp.amount, remaining)
        if pay_amount <= 0:
            continue
        original.amount_paid = (original.amount_paid or Decimal(0)) + pay_amount
        db.add(PosSalePayment(
            pos_sale_id    = original.id,
            payment_method = pbp.payment_method,
            amount         = pay_amount,
        ))

    db.commit()
    db.refresh(sale)
    return sale


# ── Open balances by customer ─────────────────────────────────

@router.get("/open-balances/customer/{customer_id}", response_model=List[PosSaleResponse])
def list_open_pos_balances(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return POS sales for a customer where balance_due > 0
    (amount_paid < total_amount). Excludes wig sales — those are tracked
    separately in the Open Wig Balances panel via /wig-orders/.
    """
    # Subquery: sales that contain a wig item (tracked via wig-orders, not here)
    wig_sale_ids = db.query(PosSaleItem.pos_sale_id).filter(
        PosSaleItem.item_type == PosItemType.wig
    ).subquery()

    sales = (
        db.query(PosSale)
        .filter(
            PosSale.customer_id == customer_id,
            PosSale.amount_paid < PosSale.total_amount,
            ~PosSale.id.in_(wig_sale_ids),
        )
        .order_by(PosSale.sale_date.desc())
        .all()
    )
    return sales


# ── List by date range ────────────────────────────────────────

@router.get("/", response_model=List[PosSaleResponse])
def list_sales_range(
    start: date = Query(...),
    end:   date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all sales between start and end dates (inclusive), newest first."""
    return (
        db.query(PosSale)
        .filter(PosSale.sale_date >= start, PosSale.sale_date <= end)
        .order_by(PosSale.sale_date.desc(), PosSale.created_at.desc())
        .all()
    )


# ── Edit sale items ───────────────────────────────────────────

@router.put("/{sale_id}/items", response_model=PosSaleResponse)
def edit_sale_items(
    sale_id: UUID,
    payload: PosSaleBulkEdit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Edit, add, or remove line items on an existing sale.
    - Wig items: unit_price editable only; cannot be removed (delete the sale instead)
    - Non-wig: all fields editable; can be removed or added
    - Recalculates sale-level totals (tax_amount, total_amount) after changes
    - Bookkeeper / owner only
    """
    if current_user.role not in (UserRole.bookkeeper, UserRole.owner):
        raise HTTPException(status_code=403, detail="Bookkeeper or owner role required")

    sale = db.get(PosSale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    for item_edit in payload.items:
        if item_edit.id:
            # Existing item — must belong to this sale
            item = db.get(PosSaleItem, item_edit.id)
            if not item or item.pos_sale_id != sale_id:
                raise HTTPException(status_code=404, detail=f"Item {item_edit.id} not found on this sale")
            if item_edit.delete:
                if item.item_type == PosItemType.wig:
                    raise HTTPException(status_code=400, detail="Wig items cannot be removed — delete the entire sale instead")
                db.delete(item)
            else:
                if item.item_type == PosItemType.wig:
                    # Wig: unit_price only (tax captured in inventory_items.sale_tax_amount at original sale time)
                    item.unit_price = item_edit.unit_price
                    item.subtotal   = (item_edit.unit_price * item.quantity).quantize(Decimal("0.01"))
                else:
                    item.description = item_edit.description
                    item.unit_price  = item_edit.unit_price
                    item.quantity    = item_edit.quantity
                    item.subtotal    = (item_edit.unit_price * item_edit.quantity).quantize(Decimal("0.01"))
                    item.notes       = item_edit.notes
                    item.tax_amount  = (item.subtotal * item_edit.tax_rate).quantize(Decimal("0.01"))
        else:
            # New item
            if item_edit.delete:
                continue  # phantom delete from frontend — skip
            if item_edit.item_type == "wig":
                raise HTTPException(status_code=400, detail="Cannot add wig items via edit")
            subtotal   = (item_edit.unit_price * item_edit.quantity).quantize(Decimal("0.01"))
            tax_amount = (subtotal * item_edit.tax_rate).quantize(Decimal("0.01"))
            db.add(PosSaleItem(
                pos_sale_id       = sale_id,
                item_type         = PosItemType(item_edit.item_type),
                description       = item_edit.description,
                unit_price        = item_edit.unit_price,
                quantity          = item_edit.quantity,
                subtotal          = subtotal,
                notes             = item_edit.notes,
                inventory_item_id = item_edit.inventory_item_id,
                tax_amount        = tax_amount,
            ))

    db.flush()
    db.refresh(sale)

    # Recompute sale totals from live items
    new_subtotal  = sum(i.subtotal              for i in sale.items)
    new_tax       = sum((i.tax_amount or Decimal(0)) for i in sale.items)
    new_discount  = payload.discount_amount if payload.discount_amount is not None else sale.discount_amount
    sale.discount_amount = new_discount
    sale.tax_amount      = new_tax.quantize(Decimal("0.01"))
    sale.total_amount    = (new_subtotal + new_tax - new_discount).quantize(Decimal("0.01"))

    # Audit note on any linked wig inventory items
    for item in sale.items:
        if item.inventory_item_id:
            db.add(InventoryEvent(
                inventory_item_id = item.inventory_item_id,
                event_type        = InventoryEventType.note,
                description       = f"Sale edited by {current_user.name or current_user.email}",
                event_date        = sale.sale_date,
                created_by        = current_user.id,
            ))

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
                # Only count the deposit — revenue recognized only at paid_in_full.
                if item.inventory_item_id:
                    wig = db.query(InventoryItem).filter(
                        InventoryItem.id == item.inventory_item_id
                    ).first()
                    if wig and wig.sale_status != WigStatus.paid_in_full:
                        result.wig_deposits_total += float(wig.amount_paid or 0)

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

    # Also capture wig payments made directly (not via POS cart) on this date.
    # Guard against double-counting: inventory_item_ids already tallied via POS items.
    pos_wig_item_ids = {
        item.inventory_item_id
        for sale in sales
        for item in sale.items
        if item.item_type == PosItemType.wig and item.inventory_item_id is not None
    }

    direct_wig_pmts = (
        db.query(WigPayment)
        .filter(WigPayment.payment_date == target_date)
        .filter(WigPayment.pos_sale_id == None)  # exclude those already captured via POS
        .all()
    )
    for wp in direct_wig_pmts:
        if wp.inventory_item_id in pos_wig_item_ids:
            continue  # Already counted above
        amt = float(wp.amount)
        if wp.payment_method == PaymentMethod.cash:
            result.cash_collected += amt
        elif wp.payment_method == PaymentMethod.credit_card:
            result.cc_collected += amt
        elif wp.payment_method == PaymentMethod.quickpay:
            result.quickpay_collected += amt
        elif wp.payment_method == PaymentMethod.check:
            result.check_collected += amt
        elif wp.payment_method == PaymentMethod.zelle:
            result.zelle_collected += amt

    return result


# ── Get one ───────────────────────────────────────────────────

@router.get("/deleted", response_model=List[DeletedSaleResponse])
def list_deleted_sales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all deleted POS sales, newest first."""
    return (
        db.query(DeletedSale)
        .order_by(DeletedSale.deleted_at.desc())
        .all()
    )


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
    payload: DeleteSalePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = db.query(PosSale).filter(PosSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="POS sale not found")

    # Step 1 — collect all wig IDs touched by this sale (balance payments + cart items)
    wig_pmts_for_sale = db.query(WigPayment).filter(
        WigPayment.pos_sale_id == sale.id
    ).all()
    affected_wig_ids = {wp.inventory_item_id for wp in wig_pmts_for_sale if wp.inventory_item_id}
    for item in sale.items:
        if item.item_type == PosItemType.wig and item.inventory_item_id:
            affected_wig_ids.add(item.inventory_item_id)

    # Step 1b — snapshot the sale into deleted_sales before anything is destroyed
    items_snap = [
        {
            "item_type":   item.item_type.value if hasattr(item.item_type, "value") else str(item.item_type),
            "description": item.description or "",
            "wig_serial":  item.wig_serial or None,
            "quantity":    item.quantity,
            "unit_price":  float(item.unit_price or 0),
            "subtotal":    float(item.subtotal or 0),
            "tax_amount":  float(item.tax_amount or 0),
        }
        for item in sale.items
    ]
    payments_snap = [
        {
            "payment_method": pmt.payment_method.value if hasattr(pmt.payment_method, "value") else str(pmt.payment_method),
            "amount":         float(pmt.amount or 0),
        }
        for pmt in sale.payments
    ]
    db.add(DeletedSale(
        original_sale_id  = sale.id,
        sale_date         = sale.sale_date,
        customer_name     = sale.customer_name,
        customer_id       = sale.customer_id,
        total_amount      = sale.total_amount or Decimal("0"),
        tax_amount        = sale.tax_amount   or Decimal("0"),
        discount_amount   = sale.discount_amount or Decimal("0"),
        deletion_reason   = payload.reason,
        deleted_by_name   = current_user.name,
        items_snapshot    = items_snap,
        payments_snapshot = payments_snap,
    ))

    # Step 2 — delete InventoryEvents and WigPayments tied to this sale
    events_for_sale = db.query(InventoryEvent).filter(
        InventoryEvent.pos_sale_id == sale.id
    ).all()
    for ev in events_for_sale:
        db.delete(ev)

    for wp in wig_pmts_for_sale:
        db.delete(wp)

    # Step 3 — delete the sale (cascades pos_sale_items + pos_sale_payments)
    db.delete(sale)
    db.flush()  # execute SQL so subsequent queries see the updated state

    # Step 3b — log a deletion note on every affected wig's history
    from datetime import date as _date
    for wig_id in affected_wig_ids:
        db.add(InventoryEvent(
            inventory_item_id = wig_id,
            event_type        = InventoryEventType.note,
            customer_id       = None,
            amount            = None,
            description       = f"Sale deleted — {payload.reason}",
            event_date        = _date.today(),
            created_by        = current_user.id,
            pos_sale_id       = None,
        ))

    # Step 4 — recompute each affected wig's state from remaining payments
    for wig_id in affected_wig_ids:
        wig = db.query(InventoryItem).filter(InventoryItem.id == wig_id).first()
        if not wig:
            continue

        remaining = db.query(WigPayment).filter(
            WigPayment.inventory_item_id == wig_id
        ).all()

        if not remaining:
            # No payments left — wig returns to inventory
            wig.customer_id         = None
            wig.customer_name       = None
            wig.customer_phone      = None
            wig.total_price         = None
            wig.amount_paid         = Decimal("0")
            wig.sale_status         = None
            wig.wig_status          = WigItemStatus.in_stock
            wig.order_date          = None
            wig.pickup_date         = None
            wig.daysmart_receipt_no = None
            wig.additional_charges  = []
            wig.sale_tax_amount     = Decimal("0")
        else:
            # Payments from other sales remain — recompute amount_paid from source of truth
            wig.amount_paid = sum(p.amount for p in remaining)
            if wig.total_price:
                full_price = wig.total_price + (wig.sale_tax_amount or Decimal(0))
                if wig.amount_paid >= full_price:
                    wig.sale_status = WigStatus.paid_in_full
                    # pickup_date stays as-is (set by the final payment sale)
                else:
                    wig.sale_status = WigStatus.ordered
                    wig.pickup_date = None

    # Step 5 — reverse any POS sale balance payments this sale triggered.
    #   The cross-reference is stored as __pos_bal__:[...] in sale.notes.
    if sale.notes:
        m = _POS_BAL_RE.search(sale.notes)
        if m:
            try:
                refs = json.loads(m.group(1))
                for ref in refs:
                    orig = db.query(PosSale).filter(
                        PosSale.id == ref["sale_id"]
                    ).first()
                    if orig:
                        orig.amount_paid = max(
                            Decimal(0),
                            (orig.amount_paid or Decimal(0)) - Decimal(str(ref["amount"]))
                        )
            except Exception:
                pass  # malformed marker — skip reversal silently

    db.commit()
