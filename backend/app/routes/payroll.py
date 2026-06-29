from collections import defaultdict
from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    CommissionPayout, Employee, PosSale, PosSaleItem, PosItemType,
    WeeklyPayroll, User, PayrollStatus,
)
from app.schemas.schemas import (
    CommissionLineItem, CommissionSaveRequest, CommissionSummaryItem,
    PayrollCreate, PayrollUpdate, PayrollResponse,
    TimedocEmployeeResult, TimedocParseRequest,
)
from app.core.security import get_current_user

router = APIRouter(prefix="/payroll", tags=["payroll"])

# Maps commission_rules label → PosItemType value
_LABEL_MAP = {
    "wash and set": PosItemType.wash_set,
    "reset":        PosItemType.wash_set,
    "wig":          PosItemType.wig,
    "fall":         PosItemType.wig,
    "repair":       PosItemType.repair,
    "inventory":    PosItemType.inventory,
}


# ── TimeDocs import ───────────────────────────────────────────

@router.post("/parse-timedoc", response_model=List[TimedocEmployeeResult])
def parse_timedoc(
    data: TimedocParseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events: list[tuple[int, datetime, int]] = []
    for line in data.content.split("\n"):
        parts = line.strip().split("\t")
        if len(parts) < 4:
            continue
        try:
            user_id   = int(parts[0].strip())
            event_dt  = datetime.strptime(parts[1].strip(), "%Y-%m-%d %H:%M:%S")
            status    = int(parts[3].strip())
        except (ValueError, IndexError):
            continue
        if not (data.week_start <= event_dt.date() <= data.week_end):
            continue
        events.append((user_id, event_dt, status))

    by_user: dict[int, list[tuple[datetime, int]]] = defaultdict(list)
    for uid, dt, st in sorted(events, key=lambda x: (x[0], x[1])):
        by_user[uid].append((dt, st))

    employees = (
        db.query(Employee)
        .filter(Employee.timedoc_number.isnot(None), Employee.is_active == True)
        .all()
    )
    emp_by_timedoc = {emp.timedoc_number: emp for emp in employees}

    results = []
    for uid, user_events in by_user.items():
        emp = emp_by_timedoc.get(uid)
        if not emp:
            continue

        total_minutes = 0.0
        missing_punch = False
        pending_in: datetime | None = None

        for dt, st in user_events:
            if st in (0, 4):            # check-in / overtime-in
                if pending_in is not None:
                    missing_punch = True
                pending_in = dt
            elif st == 1 and pending_in: # check-out
                total_minutes += (dt - pending_in).total_seconds() / 60
                pending_in = None

        if pending_in is not None:
            missing_punch = True

        total_hours = round(total_minutes / 60, 2)

        ot = emp.overtime_after_hours
        if ot and total_hours > ot:
            regular_hours  = float(ot)
            overtime_hours = round(total_hours - ot, 2)
        else:
            regular_hours  = total_hours
            overtime_hours = 0.0

        suggested_pay: float | None = None
        if emp.pay_type.value == "hourly" and emp.hourly_rate:
            r = float(emp.hourly_rate)
            suggested_pay = round(regular_hours * r + overtime_hours * r * 1.5, 2)
        elif emp.pay_type.value == "weekly_flat" and emp.weekly_rate:
            suggested_pay = float(emp.weekly_rate)

        results.append(TimedocEmployeeResult(
            employee_id=str(emp.id),
            first_name=emp.first_name,
            last_name=emp.last_name,
            timedoc_number=uid,
            total_hours=total_hours,
            regular_hours=regular_hours,
            overtime_hours=overtime_hours,
            suggested_pay=suggested_pay,
            hourly_rate=float(emp.hourly_rate) if emp.hourly_rate else None,
            weekly_rate=float(emp.weekly_rate) if emp.weekly_rate else None,
            pay_type=emp.pay_type.value,
            missing_punch=missing_punch,
        ))

    return results


# ── Commission ────────────────────────────────────────────────

@router.get("/commission-summary", response_model=List[CommissionSummaryItem])
def commission_summary(
    month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    year, mon  = int(month[:4]), int(month[5:7])
    month_start = date(year, mon, 1)
    month_end   = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)

    employees = (
        db.query(Employee)
        .filter(Employee.is_active == True)
        .all()
    )
    # Only employees that have at least one commission rule
    commission_emps = [e for e in employees if e.commission_rules]

    payouts = {
        str(p.employee_id): p
        for p in db.query(CommissionPayout)
        .filter(CommissionPayout.month == month_start)
        .all()
    }

    results = []
    for emp in commission_emps:
        rules = emp.commission_rules or []
        items = []
        total = 0.0

        for rule in rules:
            label    = str(rule.get("label", ""))
            per_item = float(rule.get("amount", 0))
            item_type_enum = _LABEL_MAP.get(label.lower())
            item_type_str  = item_type_enum.value if item_type_enum else ""

            count = 0
            if item_type_enum:
                count = (
                    db.query(func.count(PosSaleItem.id))
                    .join(PosSale, PosSale.id == PosSaleItem.pos_sale_id)
                    .filter(
                        PosSaleItem.sales_rep_id == emp.id,
                        PosSaleItem.item_type == item_type_enum,
                        PosSale.sale_date >= month_start,
                        PosSale.sale_date < month_end,
                    )
                    .scalar() or 0
                )

            line_total = count * per_item
            total += line_total
            items.append(CommissionLineItem(
                label=label, item_type=item_type_str,
                per_item=per_item, count=count, total=line_total,
            ))

        payout = payouts.get(str(emp.id))
        results.append(CommissionSummaryItem(
            employee_id=str(emp.id),
            first_name=emp.first_name,
            last_name=emp.last_name,
            items=items,
            calculated_amount=round(total, 2),
            payout_id=str(payout.id) if payout else None,
            adjustment_amount=float(payout.adjustment_amount) if payout else 0.0,
            final_amount=float(payout.final_amount) if payout else round(total, 2),
            notes=payout.notes if payout else None,
            status=payout.status if payout else "pending",
            paid_at=payout.paid_at if payout else None,
        ))

    return results


@router.post("/commission-save")
def save_commission(
    data: CommissionSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payout = (
        db.query(CommissionPayout)
        .filter(
            CommissionPayout.employee_id == data.employee_id,
            CommissionPayout.month == data.month,
        )
        .first()
    )
    if payout:
        payout.adjustment_amount = data.adjustment_amount
        payout.final_amount      = data.final_amount
        payout.notes             = data.notes
        if data.final_amount > 0 and payout.status == "paid":
            pass  # keep paid status
    else:
        payout = CommissionPayout(
            employee_id=data.employee_id,
            month=data.month,
            calculated_amount=data.calculated_amount,
            adjustment_amount=data.adjustment_amount,
            final_amount=data.final_amount,
            notes=data.notes,
        )
        db.add(payout)

    db.commit()
    db.refresh(payout)
    return {"id": str(payout.id), "status": payout.status}


@router.post("/commission-payout/{payout_id}/mark-paid")
def mark_commission_paid(
    payout_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payout = db.query(CommissionPayout).filter(CommissionPayout.id == payout_id).first()
    if not payout:
        raise HTTPException(404, "Not found")
    payout.status  = "paid"
    payout.paid_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "paid"}


@router.post("/commission-payout/{payout_id}/mark-pending")
def mark_commission_pending(
    payout_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payout = db.query(CommissionPayout).filter(CommissionPayout.id == payout_id).first()
    if not payout:
        raise HTTPException(404, "Not found")
    payout.status  = "pending"
    payout.paid_at = None
    db.commit()
    return {"status": "pending"}


# ── Weekly payroll CRUD ───────────────────────────────────────

@router.get("/", response_model=List[PayrollResponse])
def list_payroll(
    week_start: Optional[date] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date:   Optional[date] = Query(None),
    employee_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(WeeklyPayroll)
    if week_start:
        q = q.filter(WeeklyPayroll.week_start == week_start)
    if start_date:
        q = q.filter(WeeklyPayroll.week_start >= start_date)
    if end_date:
        q = q.filter(WeeklyPayroll.week_start <= end_date)
    if employee_id:
        q = q.filter(WeeklyPayroll.employee_id == employee_id)
    return q.order_by(WeeklyPayroll.week_start.desc()).all()


@router.get("/week/{week_start}", response_model=List[PayrollResponse])
def get_week_payroll(
    week_start: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(WeeklyPayroll)
        .filter(WeeklyPayroll.week_start == week_start)
        .all()
    )


@router.post("/", response_model=PayrollResponse, status_code=201)
def create_payroll_entry(
    data: PayrollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = (
        db.query(WeeklyPayroll)
        .filter(
            WeeklyPayroll.week_start == data.week_start,
            WeeklyPayroll.employee_id == data.employee_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Payroll entry already exists for this employee this week")

    entry = WeeklyPayroll(**data.model_dump(), entered_by=current_user.id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{payroll_id}", response_model=PayrollResponse)
def update_payroll_entry(
    payroll_id: UUID,
    data: PayrollUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(WeeklyPayroll).filter(WeeklyPayroll.id == payroll_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Payroll entry not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{payroll_id}", status_code=204)
def delete_payroll_entry(
    payroll_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(WeeklyPayroll).filter(WeeklyPayroll.id == payroll_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Payroll entry not found")
    db.delete(entry)
    db.commit()


@router.post("/{payroll_id}/mark-paid", response_model=PayrollResponse)
def mark_paid(
    payroll_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(WeeklyPayroll).filter(WeeklyPayroll.id == payroll_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Payroll entry not found")
    entry.status  = PayrollStatus.paid
    entry.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/{payroll_id}/mark-pending", response_model=PayrollResponse)
def mark_pending(
    payroll_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(WeeklyPayroll).filter(WeeklyPayroll.id == payroll_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Payroll entry not found")
    entry.status  = PayrollStatus.pending
    entry.paid_at = None
    db.commit()
    db.refresh(entry)
    return entry
