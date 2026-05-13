"""
Ella's tools — what she can query from the DB.

Each tool has two parts:
  1. A schema dict — tells Claude what the tool is and what parameters it takes
  2. A function — runs the actual DB query and returns a plain dict

The dispatcher at the bottom routes Claude's tool calls to the right function.
"""

import json
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.models.models import (
    DailySummary, ExpenseEntry, WeeklyPayroll, Employee,
    SaleTransaction, TransactionPayment, Customer, Deposit,
    FinancialSnapshot,
)


# ── Tool Schemas (Claude reads these) ───────────────────────────────────────

TOOLS = [
    {
        "name": "get_daily_summary",
        "description": (
            "Get the daily revenue breakdown for one day or a date range. "
            "Returns wash & set, wig sales, repairs, cash/CC/QuickPay collected, "
            "new wigs sold, and Chani cuts."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format"
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format (optional — defaults to start_date for a single day)"
                }
            },
            "required": ["start_date"]
        }
    },
    {
        "name": "get_expenses",
        "description": (
            "Get expense entries, optionally filtered by date range and/or category. "
            "Categories: itzik, grossman, monsey_driver, rent, phone_internet, "
            "hair_supplies, shipping, dalia_instagram, misc, work_purchases, "
            "food, sales_tax, reconciliation, other."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                "end_date":   {"type": "string", "description": "YYYY-MM-DD"},
                "category":   {"type": "string", "description": "Expense category to filter by (optional)"}
            }
        }
    },
    {
        "name": "get_payroll",
        "description": (
            "Get weekly payroll entries for stylists. "
            "Filter by date range and/or employee name."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date":    {"type": "string", "description": "YYYY-MM-DD — week_start on or after this date"},
                "end_date":      {"type": "string", "description": "YYYY-MM-DD — week_start on or before this date"},
                "employee_name": {"type": "string", "description": "First or last name of the stylist (optional, partial match)"}
            }
        }
    },
    {
        "name": "get_transactions",
        "description": (
            "Get individual sales transactions (wig sales, wash & set, repairs, etc.). "
            "Filter by date range and/or customer name. "
            "Returns receipt number, service type, amounts, and payment status."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date":    {"type": "string", "description": "YYYY-MM-DD"},
                "end_date":      {"type": "string", "description": "YYYY-MM-DD"},
                "customer_name": {"type": "string", "description": "First or last name of the customer (optional, partial match)"}
            }
        }
    },
    {
        "name": "get_deposits",
        "description": (
            "Get bank deposit records. Shows cash, checks, credit card, and Zelle "
            "deposited on each day, plus auto-calculated sales tax per method."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                "end_date":   {"type": "string", "description": "YYYY-MM-DD"}
            },
            "required": ["start_date"]
        }
    },
    {
        "name": "get_financial_snapshot",
        "description": (
            "Get computed financial snapshots — the full profit chain including "
            "net profit, bank portion, owner portion, tithes (מעשרות), and final take-home."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                "end_date":   {"type": "string", "description": "YYYY-MM-DD"}
            },
            "required": ["start_date"]
        }
    },
    {
        "name": "get_customers",
        "description": (
            "Search for customers by name or list all customers. "
            "Returns name, phone, cell, address, and notes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Partial first or last name to search (optional — omit to list all)"
                }
            }
        }
    },
    {
        "name": "remember_fact",
        "description": (
            "Save a note to Ella's memory. Use this when the user tells you something "
            "important that isn't captured in the database — e.g. a client preference, "
            "a special payment situation, a reminder, or a business note."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "One of: client_note, business_note, reminder, preference"
                },
                "key": {
                    "type": "string",
                    "description": "Short searchable label, e.g. 'Goldstein payment preference'"
                },
                "value": {
                    "type": "string",
                    "description": "The full note to save"
                }
            },
            "required": ["category", "key", "value"]
        }
    },
    {
        "name": "recall_facts",
        "description": (
            "Search Ella's saved memory notes. Use this before answering questions "
            "about client preferences, special situations, or anything that might "
            "have been noted in a previous conversation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Keywords to search across all saved notes"
                }
            },
            "required": ["search"]
        }
    },
]


# ── Query Functions (each returns a plain dict / list) ───────────────────────

def _date(s: str) -> date:
    """Parse YYYY-MM-DD string to a date object."""
    return date.fromisoformat(s)


def get_daily_summary(db: Session, start_date: str, end_date: str | None = None) -> dict:
    end = _date(end_date) if end_date else _date(start_date)
    start = _date(start_date)

    rows = (
        db.query(DailySummary)
        .filter(DailySummary.summary_date >= start, DailySummary.summary_date <= end)
        .order_by(DailySummary.summary_date)
        .all()
    )

    if not rows:
        return {"result": "No daily summary found for this date range."}

    return {
        "summaries": [
            {
                "date": str(r.summary_date),
                "wash_set": float(r.total_wash_set),
                "wig_sales": float(r.total_wig_sales),
                "repairs": float(r.total_repairs),
                "other": float(r.total_other),
                "total_revenue": float(r.total_revenue),
                "cash_collected": float(r.cash_collected),
                "quickpay_collected": float(r.quickpay_collected),
                "cc_collected": float(r.cc_collected),
                "check_collected": float(r.check_collected),
                "zelle_collected": float(r.zelle_collected),
                "new_wigs_sold": r.new_wigs_sold,
                "wigs_paid_full": r.wigs_paid_full,
                "chani_cuts": r.chani_cuts,
                "is_locked": r.is_locked,
                "notes": r.notes,
            }
            for r in rows
        ]
    }


def get_expenses(
    db: Session,
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
) -> dict:
    q = db.query(ExpenseEntry)

    if start_date:
        q = q.filter(ExpenseEntry.expense_date >= _date(start_date))
    if end_date:
        q = q.filter(ExpenseEntry.expense_date <= _date(end_date))
    if category:
        q = q.filter(ExpenseEntry.category == category)

    rows = q.order_by(ExpenseEntry.expense_date).all()

    if not rows:
        return {"result": "No expenses found for these filters."}

    total = sum(float(r.amount) for r in rows)
    return {
        "total": total,
        "expenses": [
            {
                "date": str(r.expense_date),
                "category": r.category.value,
                "amount": float(r.amount),
                "vendor": r.vendor,
                "notes": r.notes,
            }
            for r in rows
        ]
    }


def get_payroll(
    db: Session,
    start_date: str | None = None,
    end_date: str | None = None,
    employee_name: str | None = None,
) -> dict:
    q = db.query(WeeklyPayroll).join(Employee)

    if start_date:
        q = q.filter(WeeklyPayroll.week_start >= _date(start_date))
    if end_date:
        q = q.filter(WeeklyPayroll.week_start <= _date(end_date))
    if employee_name:
        search = f"%{employee_name}%"
        q = q.filter(
            or_(Employee.first_name.ilike(search), Employee.last_name.ilike(search))
        )

    rows = q.order_by(WeeklyPayroll.week_start, Employee.first_name).all()

    if not rows:
        return {"result": "No payroll entries found for these filters."}

    total = sum(float(r.amount) for r in rows)
    return {
        "total": total,
        "entries": [
            {
                "week_start": str(r.week_start),
                "week_end": str(r.week_end),
                "employee": f"{r.employee.first_name} {r.employee.last_name}",
                "job_title": r.employee.job_title,
                "pay_type": r.pay_type_snapshot.value,
                "amount": float(r.amount),
                "notes": r.notes,
            }
            for r in rows
        ]
    }


def get_transactions(
    db: Session,
    start_date: str | None = None,
    end_date: str | None = None,
    customer_name: str | None = None,
) -> dict:
    q = db.query(SaleTransaction)

    if start_date:
        q = q.filter(SaleTransaction.transaction_date >= _date(start_date))
    if end_date:
        q = q.filter(SaleTransaction.transaction_date <= _date(end_date))
    if customer_name:
        search = f"%{customer_name}%"
        q = q.join(Customer).filter(
            or_(Customer.first_name.ilike(search), Customer.last_name.ilike(search))
        )

    rows = q.order_by(SaleTransaction.transaction_date.desc()).limit(50).all()

    if not rows:
        return {"result": "No transactions found for these filters."}

    return {
        "count": len(rows),
        "transactions": [
            {
                "date": str(r.transaction_date),
                "receipt": r.receipt_number,
                "customer": (
                    f"{r.customer.first_name} {r.customer.last_name}"
                    if r.customer else "Unknown"
                ),
                "service_type": r.service_type.value,
                "is_chani_service": r.is_chani_service,
                "total_amount": float(r.total_amount),
                "amount_paid": float(r.amount_paid),
                "balance_due": float(r.balance_due),
                "wig_brand": r.wig_brand,
                "wig_color": r.wig_color,
                "notes": r.notes,
            }
            for r in rows
        ]
    }


def get_deposits(db: Session, start_date: str, end_date: str | None = None) -> dict:
    end = _date(end_date) if end_date else _date(start_date)
    rows = (
        db.query(Deposit)
        .filter(Deposit.deposit_date >= _date(start_date), Deposit.deposit_date <= end)
        .order_by(Deposit.deposit_date)
        .all()
    )

    if not rows:
        return {"result": "No deposits found for this date range."}

    return {
        "deposits": [
            {
                "date": str(r.deposit_date),
                "cash": float(r.cash),
                "checks": float(r.checks),
                "credit_card": float(r.credit_card),
                "zelle": float(r.zelle),
                "total": float(r.cash + r.checks + r.credit_card + r.zelle),
                "sales_tax_cash": float(r.sales_tax_cash),
                "sales_tax_cc_other": float(r.sales_tax_cc_other),
                "notes": r.notes,
            }
            for r in rows
        ]
    }


def get_financial_snapshot(db: Session, start_date: str, end_date: str | None = None) -> dict:
    end = _date(end_date) if end_date else _date(start_date)
    rows = (
        db.query(FinancialSnapshot)
        .filter(
            FinancialSnapshot.snapshot_date >= _date(start_date),
            FinancialSnapshot.snapshot_date <= end,
        )
        .order_by(FinancialSnapshot.snapshot_date)
        .all()
    )

    if not rows:
        return {"result": "No financial snapshots found for this date range."}

    return {
        "snapshots": [
            {
                "date": str(r.snapshot_date),
                "total_revenue": float(r.total_revenue),
                "total_expenses": float(r.total_expenses),
                "total_payroll": float(r.total_payroll),
                "net_profit": float(r.net_profit),
                "bank_portion": float(r.bank_portion),
                "owner_portion": float(r.owner_portion),
                "bank_tithes": float(r.bank_tithes),
                "owner_tithes": float(r.owner_tithes),
                "total_tithes": float(r.total_tithes),
                "final_take_home": float(r.final_take_home),
            }
            for r in rows
        ]
    }


def get_customers(db: Session, search: str | None = None) -> dict:
    q = db.query(Customer)

    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(Customer.first_name.ilike(like), Customer.last_name.ilike(like))
        )

    rows = q.order_by(Customer.last_name, Customer.first_name).limit(30).all()

    if not rows:
        return {"result": "No customers found."}

    return {
        "count": len(rows),
        "customers": [
            {
                "name": f"{r.first_name} {r.last_name}",
                "phone": r.phone,
                "cell": r.cell,
                "address": r.address,
                "daysmart_id": r.daysmart_client_id,
                "notes": r.notes,
            }
            for r in rows
        ]
    }


def remember_fact(
    db: Session,
    category: str,
    key: str,
    value: str,
    user_id: str | None = None,
) -> dict:
    # Import here to avoid circular issues at module load
    from app.models.models import EllaFact
    import uuid

    fact = EllaFact(
        category=category,
        key=key,
        value=value,
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(fact)
    db.commit()
    return {"result": f"Saved: '{key}'"}


def recall_facts(db: Session, search: str) -> dict:
    from app.models.models import EllaFact
    from sqlalchemy import text

    # Use PostgreSQL full-text search on the GIN index
    rows = (
        db.query(EllaFact)
        .filter(
            text("to_tsvector('english', key || ' ' || value) @@ plainto_tsquery('english', :q)")
            .bindparams(q=search)
        )
        .order_by(EllaFact.created_at.desc())
        .limit(10)
        .all()
    )

    if not rows:
        # Fall back to ILIKE if full-text finds nothing
        like = f"%{search}%"
        rows = (
            db.query(EllaFact)
            .filter(or_(EllaFact.key.ilike(like), EllaFact.value.ilike(like)))
            .order_by(EllaFact.created_at.desc())
            .limit(10)
            .all()
        )

    if not rows:
        return {"result": "No saved notes found matching that search."}

    return {
        "facts": [
            {
                "category": r.category,
                "key": r.key,
                "value": r.value,
                "saved_at": str(r.created_at),
            }
            for r in rows
        ]
    }


# ── Dispatcher ───────────────────────────────────────────────────────────────

def dispatch_tool(name: str, inputs: dict, db: Session, user_id: str | None = None) -> dict:
    """
    Routes a tool call from Claude to the right function.
    Returns a plain dict that gets JSON-serialized back to Claude.
    """
    try:
        match name:
            case "get_daily_summary":
                return get_daily_summary(db, **inputs)
            case "get_expenses":
                return get_expenses(db, **inputs)
            case "get_payroll":
                return get_payroll(db, **inputs)
            case "get_transactions":
                return get_transactions(db, **inputs)
            case "get_deposits":
                return get_deposits(db, **inputs)
            case "get_financial_snapshot":
                return get_financial_snapshot(db, **inputs)
            case "get_customers":
                return get_customers(db, **inputs)
            case "remember_fact":
                return remember_fact(db, **inputs, user_id=user_id)
            case "recall_facts":
                return recall_facts(db, **inputs)
            case _:
                return {"error": f"Unknown tool: {name}"}
    except Exception as e:
        return {"error": str(e)}
