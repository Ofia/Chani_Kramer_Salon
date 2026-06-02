"""
Pydantic schemas — the shape of data going in and out of the API.

Think of these as "contracts":
  - Request schema  = what the frontend must send
  - Response schema = what the API will return

Pydantic validates and serializes automatically.

NOTE: Response schemas use `float` for numeric fields, not `Decimal`.
Pydantic v2 serializes Decimal to JSON strings; float serializes as JSON numbers.
Create/Update schemas keep `Decimal` for precision when writing to the DB.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.models.models import (
    UserRole, PayType, PaymentMethod, ServiceType, ExpenseCategory, DataSource,
    WigStatus, WigPaymentType, PosItemType, PayrollStatus,
    InventoryItemType, WigItemStatus, InventoryEventType
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
    weekly_rate: Optional[float]
    commission_rate: Optional[float]
    hourly_rate: Optional[float]
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
    access_id: Optional[int] = None
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    cell: Optional[str] = None
    address: Optional[str] = None
    access_id: Optional[int] = None
    notes: Optional[str] = None


class CustomerResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    phone: Optional[str]
    cell: Optional[str]
    address: Optional[str]
    daysmart_client_id: Optional[str]
    access_id: Optional[int]
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
    amount: float
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
    total_amount: float
    amount_paid: float
    balance_due: float
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
    total_wash_set: float
    total_wig_sales: float
    total_repairs: float
    total_other: float
    total_revenue: float
    cash_collected: float
    quickpay_collected: float
    cc_collected: float
    check_collected: float
    zelle_collected: float
    new_wigs_sold: int
    wigs_paid_full: int
    chani_cuts: int
    wig_deposits_total: float
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
    amount: float
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
    cash_amount: Decimal = Decimal("0")
    bank_amount: Decimal = Decimal("0")
    pay_type_snapshot: PayType
    notes: Optional[str] = None


class PayrollUpdate(BaseModel):
    amount: Optional[Decimal] = None
    cash_amount: Optional[Decimal] = None
    bank_amount: Optional[Decimal] = None
    status: Optional[PayrollStatus] = None
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None


class PayrollResponse(BaseModel):
    id: UUID
    week_start: date
    week_end: date
    employee_id: UUID
    amount: float
    cash_amount: float
    bank_amount: float
    status: str
    paid_at: Optional[datetime]
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
    cash: float
    checks: float
    credit_card: float
    zelle: float
    sales_tax_cash: float
    sales_tax_cc_other: float
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Financial Snapshots ───────────────────────────────────────

class SnapshotResponse(BaseModel):
    id: UUID
    snapshot_date: date
    total_revenue: float
    total_expenses: float
    total_payroll: float
    net_profit: float
    bank_portion: float
    owner_portion: float
    bank_tithes: float
    owner_tithes: float
    total_tithes: float
    final_take_home: float
    computed_at: datetime

    class Config:
        from_attributes = True


# ── Simulation (owner "what if" tool) ────────────────────────

class SimulationInput(BaseModel):
    total_revenue: Decimal
    total_expenses: Decimal
    total_payroll: Decimal


class SimulationResponse(BaseModel):
    total_revenue: float
    total_expenses: float
    total_payroll: float
    net_profit: float
    bank_portion: float
    owner_portion: float
    bank_tithes: float
    owner_tithes: float
    total_tithes: float
    final_take_home: float


# ── Wig Orders ────────────────────────────────────────────────

class AdditionalCharge(BaseModel):
    """A single extra line item on a wig order (e.g. 'Color roots', 150.00)."""
    label: str
    amount: float


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
    amount: float
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
    additional_charges: List[AdditionalCharge] = []
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
    additional_charges: Optional[List[AdditionalCharge]] = None
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
    base_price: float
    fill_lace_price: float
    additional_charges: List[AdditionalCharge] = []
    total_price: float
    amount_paid: float
    balance_due: float
    status: WigStatus
    order_date: date
    pickup_date: Optional[date]
    notes: Optional[str]
    payments: List[WigPaymentResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── POS Sales ────────────────────────────────────────────────

class PosSalePaymentCreate(BaseModel):
    payment_method: PaymentMethod
    amount: Decimal


class PosSalePaymentResponse(BaseModel):
    id: UUID
    payment_method: PaymentMethod
    amount: float
    created_at: datetime

    class Config:
        from_attributes = True


class PosSaleItemCreate(BaseModel):
    item_type: PosItemType
    description: str
    quantity: int = 1
    unit_price: Decimal
    subtotal: Decimal
    inventory_item_id: Optional[UUID] = None
    # Wig specs — only when item_type = 'wig'
    wig_serial: Optional[str] = None
    wig_brand: Optional[str] = None
    wig_length: Optional[str] = None
    wig_color: Optional[str] = None
    wig_size: Optional[str] = None
    wig_front: Optional[str] = None
    # Deposit paid for this wig at time of sale
    wig_deposit_amount: Optional[Decimal] = None
    wig_deposit_method: Optional[PaymentMethod] = None


class PosSaleItemResponse(BaseModel):
    id: UUID
    item_type: PosItemType
    description: str
    quantity: int
    unit_price: float
    subtotal: float
    inventory_item_id: Optional[UUID]
    wig_order_id: Optional[UUID]
    wig_serial: Optional[str]
    wig_brand: Optional[str]
    wig_length: Optional[str]
    wig_color: Optional[str]
    wig_size: Optional[str]
    wig_front: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WigBalancePaymentIn(BaseModel):
    wig_order_id: UUID
    amount: Decimal
    payment_method: PaymentMethod


class PosSaleCreate(BaseModel):
    customer_id: Optional[UUID] = None
    customer_name: str
    customer_phone: Optional[str] = None
    sale_date: date
    notes: Optional[str] = None
    items: List[PosSaleItemCreate] = []
    payments: List[PosSalePaymentCreate] = []
    wig_balance_payments: List[WigBalancePaymentIn] = []


class PosSaleResponse(BaseModel):
    id: UUID
    customer_id: Optional[UUID]
    customer_name: str
    customer_phone: Optional[str]
    sale_date: date
    notes: Optional[str]
    total_amount: float
    amount_paid: float
    balance_due: float
    items: List[PosSaleItemResponse] = []
    payments: List[PosSalePaymentResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class DailyAutoFillResponse(BaseModel):
    """Pre-filled totals for Daily Entry, aggregated from POS sales on a given date."""
    total_wash_set: float = 0
    total_repairs: float = 0
    total_other: float = 0
    cash_collected: float = 0
    quickpay_collected: float = 0
    cc_collected: float = 0
    check_collected: float = 0
    zelle_collected: float = 0
    new_wigs_sold: int = 0
    wig_deposits_total: float = 0
    pos_sale_count: int = 0   # how many POS visits contributed


# ── Inventory Items ───────────────────────────────────────────

class InventoryItemCreate(BaseModel):
    item_type: InventoryItemType = InventoryItemType.product
    name: str
    notes: Optional[str] = None
    # product fields
    category: Optional[str] = None
    quantity: int = 0
    unit_price: Decimal = Decimal("0")
    # wig fields
    daysmart_serial: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    length: Optional[str] = None
    size: Optional[str] = None
    front: Optional[str] = None
    cost_price: Optional[Decimal] = None
    retail_price: Optional[Decimal] = None
    wig_status: Optional[WigItemStatus] = None
    supplier: Optional[str] = None
    arrival_date: Optional[date] = None


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    # product fields
    category: Optional[str] = None
    quantity: Optional[int] = None
    unit_price: Optional[Decimal] = None
    # wig fields
    daysmart_serial: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    length: Optional[str] = None
    size: Optional[str] = None
    front: Optional[str] = None
    cost_price: Optional[Decimal] = None
    retail_price: Optional[Decimal] = None
    wig_status: Optional[WigItemStatus] = None
    supplier: Optional[str] = None
    arrival_date: Optional[date] = None


class InventoryItemResponse(BaseModel):
    id: UUID
    item_type: InventoryItemType
    name: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    # product fields
    category: Optional[str]
    quantity: int
    unit_price: float
    # wig fields
    daysmart_serial: Optional[str]
    brand: Optional[str]
    color: Optional[str]
    length: Optional[str]
    size: Optional[str]
    front: Optional[str]
    cost_price: Optional[float]
    retail_price: Optional[float]
    wig_status: Optional[WigItemStatus]
    supplier: Optional[str]
    arrival_date: Optional[date]

    class Config:
        from_attributes = True


# ── Brand Markups ─────────────────────────────────────────────

class BrandMarkupCreate(BaseModel):
    brand: str
    markup_pct: Decimal


class BrandMarkupUpdate(BaseModel):
    markup_pct: Decimal


class BrandMarkupResponse(BaseModel):
    id: UUID
    brand: str
    markup_pct: float
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Inventory Events ──────────────────────────────────────────

class InventoryEventCreate(BaseModel):
    event_type: InventoryEventType
    customer_id: Optional[UUID] = None
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    event_date: Optional[date] = None


class InventoryEventResponse(BaseModel):
    id: UUID
    inventory_item_id: UUID
    event_type: InventoryEventType
    customer_id: Optional[UUID]
    amount: Optional[float]
    description: Optional[str]
    event_date: date
    created_by: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Hello Board ───────────────────────────────────────────────

class BoardPostCreate(BaseModel):
    content: str


class BoardPostResponse(BaseModel):
    id: UUID
    author_id: Optional[UUID]
    author_name: Optional[str]
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    title: str
    body: Optional[str] = None
    scheduled_date: Optional[date] = None
    is_pinned: bool = False


class NotificationUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    scheduled_date: Optional[date] = None
    is_pinned: Optional[bool] = None


class NotificationResponse(BaseModel):
    id: UUID
    title: str
    body: Optional[str]
    scheduled_date: Optional[date]
    is_pinned: bool
    created_by: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True


class CheckinResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    date: date
    checked_in_at: datetime

    class Config:
        from_attributes = True


# ── Customer Purchase History ─────────────────────────────────

class CustomerHistoryResponse(BaseModel):
    """
    All purchases for a single customer.
    pos_sales: visits recorded via the POS (may include wigs, services, products).
    direct_wig_orders: wig orders entered directly (not via a POS sale — avoids double-counting).
    """
    pos_sales: List[PosSaleResponse]
    direct_wig_orders: List[WigOrderResponse]


# ── Employee Time Logs ────────────────────────────────────────

class TimeLogClockIn(BaseModel):
    employee_id: UUID
    notes: Optional[str] = None


class TimeLogClockOut(BaseModel):
    notes: Optional[str] = None


class TimeLogResponse(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: str          # first + last, resolved in route
    clock_in: datetime
    clock_out: Optional[datetime]
    date: date
    hours: Optional[float]      # None while still clocked in
    logged_by: Optional[UUID]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WeekHoursSummaryItem(BaseModel):
    """Hours worked by one employee for a given week."""
    employee_id: UUID
    employee_name: str
    pay_type: PayType
    hourly_rate: Optional[float]
    total_hours: float
    suggested_pay: Optional[float]  # hours × rate for hourly employees; None otherwise
