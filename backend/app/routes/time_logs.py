"""
Employee time log routes — clock-in / clock-out.

Payroll week: Wednesday → Tuesday (7 days). Paid on Thursdays.
Front desk person logs employees in and out via the Hello Board dropdown.
"""

from datetime import date, datetime, timedelta
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Employee, EmployeeTimeLog, User
from app.schemas.schemas import (
    TimeLogClockIn, TimeLogClockOut, TimeLogResponse, WeekHoursSummaryItem
)
from app.core.security import get_current_user

router = APIRouter(prefix="/time-logs", tags=["time-logs"])


# ── Helpers ──────────────────────────────────────────────────

def _log_to_response(log: EmployeeTimeLog) -> TimeLogResponse:
    emp = log.employee
    name = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
    hours = None
    if log.clock_out:
        delta = log.clock_out - log.clock_in
        hours = round(delta.total_seconds() / 3600, 2)
    return TimeLogResponse(
        id=log.id,
        employee_id=log.employee_id,
        employee_name=name,
        clock_in=log.clock_in,
        clock_out=log.clock_out,
        date=log.date,
        hours=hours,
        logged_by=log.logged_by,
        notes=log.notes,
        created_at=log.created_at,
    )


def _week_bounds(week_start: date):
    """Return (start, end) for the Wed-starting week containing week_start.
    week_start must already be a Wednesday.
    """
    return week_start, week_start + timedelta(days=6)


# ── Clock In ─────────────────────────────────────────────────

@router.post("/clock-in", response_model=TimeLogResponse, status_code=201)
def clock_in(
    data: TimeLogClockIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp = db.query(Employee).filter(Employee.id == data.employee_id, Employee.is_active == True).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found or inactive")

    # Prevent double clock-in (open log = no clock_out)
    today = date.today()
    open_log = (
        db.query(EmployeeTimeLog)
        .filter(
            EmployeeTimeLog.employee_id == data.employee_id,
            EmployeeTimeLog.date == today,
            EmployeeTimeLog.clock_out.is_(None),
        )
        .first()
    )
    if open_log:
        raise HTTPException(status_code=409, detail=f"{emp.first_name} is already clocked in")

    log = EmployeeTimeLog(
        employee_id=data.employee_id,
        logged_by=current_user.id,
        notes=data.notes,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _log_to_response(log)


# ── Clock Out ────────────────────────────────────────────────

@router.post("/clock-out/{employee_id}", response_model=TimeLogResponse)
def clock_out(
    employee_id: UUID,
    data: TimeLogClockOut,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    log = (
        db.query(EmployeeTimeLog)
        .filter(
            EmployeeTimeLog.employee_id == employee_id,
            EmployeeTimeLog.date == today,
            EmployeeTimeLog.clock_out.is_(None),
        )
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="No open clock-in found for this employee today")

    log.clock_out = datetime.utcnow()
    if data.notes:
        log.notes = data.notes
    db.commit()
    db.refresh(log)
    return _log_to_response(log)


# ── Today's Status ───────────────────────────────────────────

@router.get("/today", response_model=List[TimeLogResponse])
def get_today_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All clock-in records for today — includes both open and closed."""
    today = date.today()
    logs = (
        db.query(EmployeeTimeLog)
        .filter(EmployeeTimeLog.date == today)
        .order_by(EmployeeTimeLog.clock_in)
        .all()
    )
    return [_log_to_response(l) for l in logs]


# ── Week Summary (for Payroll page) ─────────────────────────

@router.get("/week-summary/{week_start}", response_model=List[WeekHoursSummaryItem])
def get_week_summary(
    week_start: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Total hours per employee for the 7-day week starting on week_start (a Wednesday).
    Only counts logs where clock_out is set (ignores still-open shifts).
    """
    start, end = _week_bounds(week_start)

    logs = (
        db.query(EmployeeTimeLog)
        .filter(
            EmployeeTimeLog.date >= start,
            EmployeeTimeLog.date <= end,
            EmployeeTimeLog.clock_out.isnot(None),
        )
        .all()
    )

    # Group hours by employee
    hours_map: dict[UUID, float] = {}
    for log in logs:
        delta = log.clock_out - log.clock_in
        hrs = delta.total_seconds() / 3600
        hours_map[log.employee_id] = hours_map.get(log.employee_id, 0.0) + hrs

    # Build response
    result = []
    for emp_id, total_hours in hours_map.items():
        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        if not emp:
            continue
        suggested = None
        if emp.pay_type.value == "hourly" and emp.hourly_rate:
            suggested = round(total_hours * float(emp.hourly_rate), 2)
        result.append(WeekHoursSummaryItem(
            employee_id=emp.id,
            employee_name=f"{emp.first_name} {emp.last_name}",
            pay_type=emp.pay_type,
            hourly_rate=float(emp.hourly_rate) if emp.hourly_rate else None,
            total_hours=round(total_hours, 2),
            suggested_pay=suggested,
        ))

    result.sort(key=lambda x: x.employee_name)
    return result
