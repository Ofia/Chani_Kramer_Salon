"""
Operation Overview — aggregate reports for daily / monthly / date-range views.

GET /reports/?start=YYYY-MM-DD&end=YYYY-MM-DD

Returns a single ReportData payload covering:
  - Revenue breakdown (W&S, Repairs, Products, Wig Sales)
  - Payment method totals + tax collected
  - Expense totals by category (for pie chart)
  - Expense entry list
  - Payroll totals by employee (for bar chart)
  - Net profit + tithes
"""

from datetime import date
from typing import List, Dict
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.models import (
    PosSale, PosSaleItem, PosSalePayment,
    WigPayment, InventoryItem, InventoryItemType, WigStatus,
    ExpenseEntry, ExpenseCategory,
    WeeklyPayroll,
    PaymentMethod, PosItemType, User,
)
from app.schemas.schemas import ExpenseResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


# ── Response shapes ───────────────────────────────────────────

class ReportRevenue(BaseModel):
    wash_set:      float = 0
    repairs:       float = 0
    product_sales: float = 0
    wig_sales:     float = 0   # paid_in_full only
    wig_deposits:  float = 0   # cash held, NOT revenue
    total:         float = 0


class ReportPayments(BaseModel):
    cash:          float = 0
    credit_card:   float = 0
    quickpay:      float = 0
    check:         float = 0
    zelle:         float = 0
    total:         float = 0
    tax_collected: float = 0   # sum of pos_sales.tax_amount


class ExpensePieSlice(BaseModel):
    category:      str
    label:         str
    amount:        float


class PayrollBar(BaseModel):
    name:          str
    amount:        float
    week_start:    str


class ReportData(BaseModel):
    period_start:        date
    period_end:          date
    revenue:             ReportRevenue
    payments:            ReportPayments
    expense_by_category: List[ExpensePieSlice]
    expense_entries:     List[ExpenseResponse]
    payroll_by_employee: List[PayrollBar]
    total_expenses:      float
    total_payroll:       float
    net_profit:          float
    tithes:              float


# ── Category display labels ────────────────────────────────────

CATEGORY_LABELS: Dict[str, str] = {
    "rent_facilities":         "Rent & Facilities",
    "utilities":               "Utilities",
    "supplies_materials":      "Supplies & Materials",
    "cost_of_goods":           "Cost of Goods",
    "marketing_advertising":   "Marketing & Advertising",
    "transportation_shipping": "Transportation & Shipping",
    "maintenance_repairs":     "Maintenance & Repairs",
    "food_beverages":          "Food & Beverages",
    "professional_services":   "Professional Services",
    "taxes_fees":              "Taxes & Fees",
    "charitable_giving":       "Charitable Giving (מעשרות)",
    "reconciliation":          "Reconciliation",
    "other":                   "Other",
}


# ── Endpoint ──────────────────────────────────────────────────

@router.get("/", response_model=ReportData)
def get_report(
    start: date = Query(...),
    end:   date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ── 1. POS sales in range ──────────────────────────────
    pos_sales = (
        db.query(PosSale)
        .filter(PosSale.sale_date >= start, PosSale.sale_date <= end)
        .options(joinedload(PosSale.items), joinedload(PosSale.payments))
        .all()
    )

    # ── 2. Revenue from POS line items ────────────────────
    wash_set = repairs = product_sales = 0.0
    for sale in pos_sales:
        for item in sale.items:
            amt = float(item.subtotal)
            if item.item_type == PosItemType.wash_set:
                wash_set += amt
            elif item.item_type == PosItemType.repair:
                repairs += amt
            elif item.item_type == PosItemType.inventory:
                product_sales += amt
            # wig items excluded here — counted via paid_in_full below

    # ── 3. Wig sales recognized (paid_in_full in range) ──
    wig_sales_items = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.item_type  == InventoryItemType.wig,
            InventoryItem.sale_status == WigStatus.paid_in_full,
            InventoryItem.pickup_date >= start,
            InventoryItem.pickup_date <= end,
        )
        .all()
    )
    wig_sales = sum(float(w.total_price or 0) for w in wig_sales_items)

    # ── 4. Wig deposits held (ordered during range, not yet paid) ──
    wig_deposit_items = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.item_type   == InventoryItemType.wig,
            InventoryItem.sale_status != WigStatus.paid_in_full,
            InventoryItem.sale_status.isnot(None),
            InventoryItem.order_date  >= start,
            InventoryItem.order_date  <= end,
        )
        .all()
    )
    wig_deposits = sum(float(w.amount_paid or 0) for w in wig_deposit_items)

    # ── 5. Payment method totals ──────────────────────────
    #
    # Strategy (no double-counting):
    #   A) ALL PosSalePayments from POS sales in the range — this captures every
    #      dollar that came through the register: services, products, wig deposits,
    #      and wig balance payments. The POS always records the real cash flow.
    #   B) WigPayments where pos_sale_id IS NULL — manual entries made outside
    #      the POS (e.g. direct wig payment recorded separately).
    #
    # Why NOT "all WigPayments": wig deposits and balance payments each create
    # BOTH a WigPayment AND a PosSalePayment. Counting both leads to double-counting.
    # The PosSalePayment is the authoritative cash-flow record for anything via POS.
    #
    cash = cc = quickpay = check = zelle = 0.0
    tax_collected = 0.0

    def _add_by_method(method, amt: float) -> None:
        nonlocal cash, cc, quickpay, check, zelle
        if method == PaymentMethod.cash:
            cash += amt
        elif method == PaymentMethod.credit_card:
            cc += amt
        elif method == PaymentMethod.quickpay:
            quickpay += amt
        elif method == PaymentMethod.check:
            check += amt
        elif method == PaymentMethod.zelle:
            zelle += amt

    # A) All PosSalePayments — real cash flow through the register
    for sale in pos_sales:
        for pmt in sale.payments:
            _add_by_method(pmt.payment_method, float(pmt.amount))

        # Tax: wig item tax is deferred to pickup_date — count only non-wig tax now.
        has_wig = any(item.item_type == PosItemType.wig for item in sale.items)
        if has_wig:
            non_wig_tax = sum(
                float(item.tax_amount)
                for item in sale.items
                if item.item_type != PosItemType.wig
            )
            tax_collected += non_wig_tax
        else:
            tax_collected += float(sale.tax_amount)

    # B) Direct WigPayments not linked to a POS sale (manual entries)
    direct_wig_pmts = (
        db.query(WigPayment)
        .filter(
            WigPayment.payment_date >= start,
            WigPayment.payment_date <= end,
            WigPayment.pos_sale_id.is_(None),
        )
        .all()
    )
    for wp in direct_wig_pmts:
        _add_by_method(wp.payment_method, float(wp.amount))

    # C) Wig tax recognized on pickup_date (same wigs already counted for revenue)
    wig_tax = sum(float(w.sale_tax_amount or 0) for w in wig_sales_items)
    tax_collected += wig_tax

    payments_total = cash + cc + quickpay + check + zelle

    # ── 6. Expenses ───────────────────────────────────────
    expenses = (
        db.query(ExpenseEntry)
        .filter(
            ExpenseEntry.expense_date >= start,
            ExpenseEntry.expense_date <= end,
        )
        .order_by(ExpenseEntry.expense_date.desc())
        .all()
    )

    expense_by_cat: Dict[str, float] = {}
    for e in expenses:
        cat = e.category.value
        expense_by_cat[cat] = expense_by_cat.get(cat, 0.0) + float(e.amount)

    expense_pie = [
        ExpensePieSlice(
            category=k,
            label=CATEGORY_LABELS.get(k, k),
            amount=v,
        )
        for k, v in sorted(expense_by_cat.items(), key=lambda x: -x[1])
    ]

    total_expenses = sum(float(e.amount) for e in expenses)

    # ── 7. Payroll ────────────────────────────────────────
    payroll_entries = (
        db.query(WeeklyPayroll)
        .filter(
            WeeklyPayroll.week_start >= start,
            WeeklyPayroll.week_start <= end,
        )
        .options(joinedload(WeeklyPayroll.employee))
        .all()
    )

    payroll_by_emp: Dict[str, float] = {}
    for p in payroll_entries:
        emp = p.employee
        name = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
        payroll_by_emp[name] = payroll_by_emp.get(name, 0.0) + float(p.amount)

    payroll_bars = [
        PayrollBar(name=k, amount=v, week_start=str(start))
        for k, v in sorted(payroll_by_emp.items(), key=lambda x: -x[1])
    ]

    total_payroll = sum(float(p.amount) for p in payroll_entries)

    # ── 8. Summary ────────────────────────────────────────
    total_revenue = wash_set + repairs + product_sales + wig_sales
    net_profit    = total_revenue - total_expenses - total_payroll
    tithes        = max(0.0, net_profit) / 10.0   # 10% of positive net profit

    return ReportData(
        period_start=start,
        period_end=end,
        revenue=ReportRevenue(
            wash_set=wash_set,
            repairs=repairs,
            product_sales=product_sales,
            wig_sales=wig_sales,
            wig_deposits=wig_deposits,
            total=total_revenue,
        ),
        payments=ReportPayments(
            cash=cash,
            credit_card=cc,
            quickpay=quickpay,
            check=check,
            zelle=zelle,
            total=payments_total,
            tax_collected=tax_collected,
        ),
        expense_by_category=expense_pie,
        expense_entries=expenses,
        payroll_by_employee=payroll_bars,
        total_expenses=total_expenses,
        total_payroll=total_payroll,
        net_profit=net_profit,
        tithes=tithes,
    )
