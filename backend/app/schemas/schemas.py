"""
Pydantic schemas — the shape of data going in and out of the API.

Think of these as "contracts":
  - Request schema  = what the frontend must send
  - Response schema = what the API will return

Pydantic validates and serializes automatically.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.models.models import (
    UserRole, PayType, PaymentMethod, ServiceType, ExpenseCategory, DataSource,
    WigStatus, WigPaymentType
)


# ── Users ────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


# ── Employees ────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    job_title: str
    pay_type: PayType
    weekly_rate: Optional[Decimal] = None
    commission_rate: Optional[Decimal] = None
    hourly_rate: Optional[Decimal] = None
    is_active: bool = True
    notes: Optional[str] = None
    hired_at: Optional[date] = None


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    job_title: Optional[str] = None
    pay_type: Optional[PayType] = None
    weekly_rate: Optional[Decimal] = None
    commission_rate: Optional[Decimal] = None
    hourly_rate: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    job_title: str
    pay_type: PayType
    weekly_rate: Optional[Decimal]
    commission_rate: Optional[Decimal]
    hourly_rate: Optional[Decimal]
    is_active: bool
    notes: Optional[str]
    hired_at: Optional[date]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Customers ────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    first_name: str
    last_name: str
    phone: Optional[str] = None
    cell: Optional[str] = None
    address: Optional[str] = None
    daysmart_client_id: Optional[str] = None
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    cell: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class CustomerResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    phone: Optional[str]
    cell: Optional[str]
    address: Optional[str]
    daysmart_client_id: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Transaction Payments ──────────────────────────────────────

class PaymentCreate(BaseModel):
    payment_method: PaymentMethod
    amount: Decimal
    payment_date: date
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: UUID
    transaction_id: UUID
    payment_method: PaymentMethod
    amount: Decimal
    payment_date: date
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Sales Transactions ───────────────────────────────────────

class TransactionCreate(BaseModel):
    receipt_number: Optional[str] = None
    customer_id: Optional[UUID] = None
    transaction_date: date
    service_type: ServiceType
    is_chani_service: bool = False
    wig_brand: Optional[str] = None
    wig_model: Optional[str] = None
    wig_length: Optional[str] = None
    wig_color: Optional[str] = None
    wig_size: Optional[str] = None
    wig_front: Optional[str] = None
    total_amount: Decimal = Decimal("0")
    amount_paid: Decimal = Decimal("0")
    notes: Optional[str] = None
    payments: Optional[List[PaymentCreate]] = []


class TransactionUpdate(BaseModel):
    service_type: Optional[ServiceType] = None
    is_chani_service: Optional[bool] = None
    wig_brand: Optional[str] = None
    wig_model: Optional[str] = None
    total_amount: Optional[Decimal] = None
    amount_paid: Optional[Decimal] = None
    notes: Optional[str] = None


class TransactionResponse(BaseModel):
    id: UUID
    receipt_number: Optional[str]
    customer_id: Optional[UUID]
    transaction_date: date
    service_type: ServiceType
    is_chani_service: bool
    wig_brand: Optional[str]
    wig_model: Optional[str]
    wig_length: Optional[str]
    wig_color: Optional[str]
    wig_size: Optional[str]
    wig_front: Optional[str]
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    notes: Optional[str]
    source: DataSource
    payments: List[PaymentResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ── Daily Summary ─────────────────────────────────────────────

class DailySummaryCreate(BaseModel):
    summary_date: date
    total_wash_set: Decimal = Decimal("0")
    total_wig_sales: Decimal = Decimal("0")
    total_repairs: Decimal = Decimal("0")
    total_other: Decimal = Decimal("0")
    cash_collected: Decimal = Decimal("0")
    quickpay_collected: Decimal = Decimal("0")
    cc_collected: Decimal = Decimal("0")
    check_collected: Decimal = Decimal("0")
    zelle_collected: Decimal = Decimal("0")
    new_wigs_sold: int = 0
    wigs_paid_full: int = 0
    chani_cuts: int = 0
    wig_deposits_total: Decimal = Decimal("0")
    notes: Optional[str] = None


class DailySummaryUpdate(BaseModel):
    total_wash_set: Optional[Decimal] = None
    total_wig_sales: Optional[Decimal] = None
    total_repairs: Optional[Decimal] = None
    total_other: Optional[Decimal] = None
    cash_collected: Optional[Decimal] = None
    quickpay_collected: Optional[Decimal] = None
    cc_collected: Optional[Decimal] = None
    check_collected: Optional[Decimal] = None
    zelle_collected: Optional[Decimal] = None
    new_wigs_sold: Optional[int] = None
    wigs_paid_full: Optional[int] = None
    chani_cuts: Optional[int] = None
    wig_deposits_total: Optional[Decimal] = None
    notes: Optional[str] = None


class DailySummaryResponse(BaseModel):
    id: UUID
    summary_date: date
    total_wash_set: Decimal
    total_wig_sales: Decimal
    total_repairs: Decimal
    total_other: Decimal
    total_revenue: Decimal
    cash_collected: Decimal
    quickpay_collected: Decimal
    cc_collected: Decimal
    check_collected: Decimal
    zelle_collected: Decimal
    new_wigs_sold: int
    wigs_paid_full: int
    chani_cuts: int
    wig_deposits_total: Decimal
    is_locked: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Expense Entries ───────────────────────────────────────────

class ExpenseCreate(BaseModel):
    expense_date: date
    category: ExpenseCategory
    amount: Decimal
    vendor: Optional[str] = None
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    category: Optional[ExpenseCategory] = None
    amount: Optional[Decimal] = None
    vendor: Optional[str] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: UUID
    expense_date: date
    category: ExpenseCategory
    amount: Decimal
    vendor: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Weekly Payroll ────────────────────────────────────────────

class PayrollCreate(BaseModel):
    week_start: date
    week_end: date
    employee_id: UUID
    amount: Decimal
    pay_type_snapshot: PayType
    notes: Optional[str] = None


class PayrollUpdate(BaseModel):
    amount: Optional[Decimal] = None
    notes: Optional[str] = None


class PayrollResponse(BaseModel):
    id: UUID
    week_start: date
    week_end: date
    employee_id: UUID
    amount: Decimal
    pay_type_snapshot: PayType
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Deposits ──────────────────────────────────────────────────

class DepositCreate(BaseModel):
    deposit_date: date
    cash: Decimal = Decimal("0")
    checks: Decimal = Decimal("0")
    credit_card: Decimal = Decimal("0")
    zelle: Decimal = Decimal("0")
    notes: Optional[str] = None


class DepositUpdate(BaseModel):
    cash: Optional[Decimal] = None
    checks: Optional[Decimal] = None
    credit_card: Optional[Decimal] = None
    zelle: Optional[Decimal] = None
    notes: Optional[str] = None


class DepositResponse(BaseModel):
    id: UUID
    deposit_date: date
    cash: Decimal
    checks: Decimal
    credit_card: Decimal
    zelle: Decimal
    sales_tax_cash: Decimal
    sales_tax_cc_other: Decimal
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Financial Snapshots ───────────────────────────────────────

class SnapshotResponse(BaseModel):
    id: UUID
    snapshot_date: date
    total_revenue: Decimal
    total_expenses: Decimal
    total_payroll: Decimal
    net_profit: Decimal
    bank_portion: Decimal
    owner_portion: Decimal
    bank_tithes: Decimal
    owner_tithes: Decimal
    total_tithes: Decimal
    final_take_home: Decimal
    computed_at: datetime

    class Config:
        from_attributes = True


# ── Simulation (owner "what if" tool) ────────────────────────

class SimulationInput(BaseModel):
    total_revenue: Decimal
    total_expenses: Decimal
    total_payroll: Decimal


class SimulationResponse(BaseModel):
    total_revenue: Decimal
    total_expenses: Decimal
    total_payroll: Decimal
    net_profit: Decimal
    bank_portion: Decimal
    owner_portion: Decimal
    bank_tithes: Decimal
    owner_tithes: Decimal
    total_tithes: Decimal
    final_take_home: Decimal


# ── Wig Orders ────────────────────────────────────────────────

class WigPaymentCreate(BaseModel):
    payment_date: date
    amount: Decimal
    payment_method: PaymentMethod
    payment_type: WigPaymentType = WigPaymentType.deposit
    notes: Optional[str] = None


class WigPaymentResponse(BaseModel):
    id: UUID
    wig_order_id: UUID
    payment_date: date
    amount: Decimal
    payment_method: PaymentMethod
    payment_type: WigPaymentType
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WigOrderCreate(BaseModel):
    daysmart_serial: Optional[str] = None
    daysmart_receipt_no: Optional[str] = None
    customer_name: str
    customer_phone: Optional[str] = None
    customer_id: Optional[UUID] = None
    brand: Optional[str] = None
    length: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    front: Optional[str] = None
    base_price: Decimal = Decimal("0")
    fill_lace_price: Decimal = Decimal("0")
    total_price: Decimal = Decimal("0")
    order_date: date
    notes: Optional[str] = None
    initial_payment: Optional[WigPaymentCreate] = None  # deposit paid at time of sale


class WigOrderUpdate(BaseModel):
    daysmart_serial: Optional[str] = None
    daysmart_receipt_no: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    brand: Optional[str] = None
    length: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    front: Optional[str] = None
    base_price: Optional[Decimal] = None
    fill_lace_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    status: Optional[WigStatus] = None
    pickup_date: Optional[date] = None
    notes: Optional[str] = None


class WigOrderResponse(BaseModel):
    id: UUID
    daysmart_serial: Optional[str]
    daysmart_receipt_no: Optional[str]
    customer_name: str
    customer_phone: Optional[str]
    customer_id: Optional[UUID]
    brand: Optional[str]
    length: Optional[str]
    color: Optional[str]
    size: Optional[str]
    front: Optional[str]
    base_price: Decimal
    fill_lace_price: Decimal
    total_price: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    status: WigStatus
    order_date: date
    pickup_date: Optional[date]
    notes: Optional[str]
    payments: List[WigPaymentResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
