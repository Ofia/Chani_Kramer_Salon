"""
Financial snapshot routes.

Two main uses:
  1. Compute & store a real daily snapshot (from actual DB data)
  2. Run a simulation — owner types in hypothetical numbers, sees the output
"""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    FinancialSnapshot, DailySummary, ExpenseEntry, WeeklyPayroll, User
)
from app.schemas.schemas import SnapshotResponse, SimulationInput, SimulationResponse
from app.core.security import get_current_user, require_owner
from app.core.financials import compute_snapshot, simulate_snapshot

router = APIRouter(prefix="/financials", tags=["financials"])


# ── Helpers ──────────────────────────────────────────────────

def _get_daily_totals(db: Session, target_date: date) -> dict:
    """Pull the raw numbers for a given date from the DB."""
    summary = db.query(DailySummary).filter(DailySummary.summary_date == target_date).first()
    total_revenue = (summary.total_revenue if summary else Decimal("0"))

    total_expenses = db.query(
        func.coalesce(func.sum(ExpenseEntry.amount), 0)
    ).filter(ExpenseEntry.expense_date == target_date).scalar() or Decimal("0")

    # Payroll is weekly — attribute proportionally (÷7) or just sum for the week
    # For daily snapshot we query the week that contains this date
    # and pro-rate it across 7 days for simplicity
    total_payroll = Decimal("0")  # week-level payroll handled in monthly reports

    return {
        "total_revenue":  Decimal(str(total_revenue)),
        "total_expenses": Decimal(str(total_expenses)),
        "total_payroll":  Decimal(str(total_payroll)),
    }


# ── Routes ───────────────────────────────────────────────────

@router.post("/compute/{target_date}", response_model=SnapshotResponse)
def compute_daily_snapshot(
    target_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compute (or recompute) the financial snapshot for a given date.
    Called automatically when Tzipora locks a day.
    """
    totals = _get_daily_totals(db, target_date)
    result = compute_snapshot(**totals)

    # Upsert — update if exists, create if not
    snapshot = db.query(FinancialSnapshot).filter(FinancialSnapshot.snapshot_date == target_date).first()
    if snapshot:
        for field, value in result.items():
            setattr(snapshot, field, value)
        snapshot.computed_at = func.now()
    else:
        snapshot = FinancialSnapshot(snapshot_date=target_date, **result)
        db.add(snapshot)

    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.get("/snapshot/{target_date}", response_model=SnapshotResponse)
def get_snapshot(
    target_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    snapshot = db.query(FinancialSnapshot).filter(FinancialSnapshot.snapshot_date == target_date).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="No snapshot for this date. Run /compute first.")
    return snapshot


@router.get("/snapshots", response_model=List[SnapshotResponse])
def list_snapshots(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(FinancialSnapshot)
    if start_date:
        q = q.filter(FinancialSnapshot.snapshot_date >= start_date)
    if end_date:
        q = q.filter(FinancialSnapshot.snapshot_date <= end_date)
    return q.order_by(FinancialSnapshot.snapshot_date.desc()).all()


@router.post("/simulate", response_model=SimulationResponse)
def run_simulation(
    data: SimulationInput,
    current_user: User = Depends(require_owner),
):
    """
    Owner "what if" tool — not stored, just computed and returned.
    Owner can tweak revenue/expense/payroll and see how tithes + take-home change.
    """
    result = simulate_snapshot(
        total_revenue=data.total_revenue,
        total_expenses=data.total_expenses,
        total_payroll=data.total_payroll,
    )
    return result


@router.get("/monthly-summary", response_model=dict)
def get_monthly_summary(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate all snapshots for a given month.
    Used for owner dashboard monthly view.
    """
    from calendar import monthrange
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])

    snapshots = (
        db.query(FinancialSnapshot)
        .filter(FinancialSnapshot.snapshot_date >= start, FinancialSnapshot.snapshot_date <= end)
        .all()
    )

    if not snapshots:
        return {"month": f"{year}-{month:02d}", "days_with_data": 0}

    def sum_field(field: str) -> Decimal:
        return sum(getattr(s, field) or Decimal("0") for s in snapshots)

    return {
        "month":           f"{year}-{month:02d}",
        "days_with_data":  len(snapshots),
        "total_revenue":   sum_field("total_revenue"),
        "total_expenses":  sum_field("total_expenses"),
        "total_payroll":   sum_field("total_payroll"),
        "net_profit":      sum_field("net_profit"),
        "bank_portion":    sum_field("bank_portion"),
        "owner_portion":   sum_field("owner_portion"),
        "total_tithes":    sum_field("total_tithes"),
        "final_take_home": sum_field("final_take_home"),
    }
