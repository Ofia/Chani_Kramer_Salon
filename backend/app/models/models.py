"""
SQLAlchemy models — Python classes that map to database tables.

Think of each class as a "blueprint" for a table row.
Each attribute = one column.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey,
    Integer, Numeric, String, Text, UniqueConstraint, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


# ── Helpers ─────────────────────────────────────────────────

def gen_uuid():
    return str(uuid.uuid4())


# ── Enums (mirror the SQL enums) ────────────────────────────

import enum

class UserRole(str, enum.Enum):
    bookkeeper = "bookkeeper"
    owner = "owner"

class PayType(str, enum.Enum):
    weekly_flat = "weekly_flat"
    commission_pct = "commission_pct"
    hourly = "hourly"

class PaymentMethod(str, enum.Enum):
    cash = "cash"
    credit_card = "credit_card"
    quickpay = "quickpay"
    check = "check"
    zelle = "zelle"

class ServiceType(str, enum.Enum):
    wig_sale = "wig_sale"
    wash_set = "wash_set"
    repair = "repair"
    fill_lace = "fill_lace"
    lining = "lining"
    dark_roots = "dark_roots"
    lowlights = "lowlights"
    fix_cut = "fix_cut"
    finish_cut = "finish_cut"
    reset = "reset"
    wash_only = "wash_only"
    shipping = "shipping"
    bf_sale = "bf_sale"
    lace_band = "lace_band"
    chani_wash_set = "chani_wash_set"
    other_wash_set = "other_wash_set"
    other_reset = "other_reset"
    new_wig_cut = "new_wig_cut"
    other = "other"

class WigStatus(str, enum.Enum):
    ordered = "ordered"          # deposit paid, wig being made
    ready = "ready"              # wig arrived, waiting for client
    paid_in_full = "paid_in_full"  # fully paid and picked up

class WigPaymentType(str, enum.Enum):
    deposit = "deposit"
    partial = "partial"
    final = "final"

class ExpenseCategory(str, enum.Enum):
    itzik = "itzik"
    grossman = "grossman"
    monsey_driver = "monsey_driver"
    rent = "rent"
    phone_internet = "phone_internet"
    hair_supplies = "hair_supplies"
    shipping = "shipping"
    dalia_instagram = "dalia_instagram"
    misc = "misc"
    work_purchases = "work_purchases"
    food = "food"
    sales_tax = "sales_tax"
    reconciliation = "reconciliation"
    other = "other"

class DataSource(str, enum.Enum):
    manual = "manual"
    ai_extracted = "ai_extracted"


# ── Tables ──────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supabase_uid = Column(UUID(as_uuid=True), unique=True, nullable=False)
    name         = Column(String, nullable=False)
    email        = Column(String, unique=True, nullable=False)
    role         = Column(Enum(UserRole), nullable=False, default=UserRole.bookkeeper)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())


class Employee(Base):
    __tablename__ = "employees"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name      = Column(String, nullable=False)
    last_name       = Column(String, nullable=False)
    job_title       = Column(String, nullable=False)
    pay_type        = Column(Enum(PayType), nullable=False)
    weekly_rate     = Column(Numeric(10, 2))
    commission_rate = Column(Numeric(5, 4))
    hourly_rate     = Column(Numeric(10, 2))
    is_active       = Column(Boolean, nullable=False, default=True)
    notes           = Column(Text)
    hired_at        = Column(Date)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    payroll_entries = relationship("WeeklyPayroll", back_populates="employee")


class Customer(Base):
    __tablename__ = "customers"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name          = Column(String, nullable=False)
    last_name           = Column(String, nullable=False)
    phone               = Column(String)
    cell                = Column(String)
    address             = Column(Text)
    daysmart_client_id  = Column(String, unique=True)
    access_id           = Column(Integer, unique=True)   # Access/Sheitel.mdb row ID for upsert imports
    notes               = Column(Text)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("SaleTransaction", back_populates="customer")


class SaleTransaction(Base):
    __tablename__ = "sales_transactions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    receipt_number   = Column(String)
    customer_id      = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"))
    transaction_date = Column(Date, nullable=False)
    service_type     = Column(Enum(ServiceType), nullable=False)
    is_chani_service = Column(Boolean, nullable=False, default=False)

    wig_brand  = Column(String)
    wig_model  = Column(String)
    wig_length = Column(String)
    wig_color  = Column(String)
    wig_size   = Column(String)
    wig_front  = Column(String)

    total_amount = Column(Numeric(10, 2), nullable=False, default=0)
    amount_paid  = Column(Numeric(10, 2), nullable=False, default=0)
    # balance_due is computed in SQL — we expose it as a property

    notes      = Column(Text)
    source     = Column(Enum(DataSource), nullable=False, default=DataSource.manual)
    entered_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="transactions")
    payments = relationship("TransactionPayment", back_populates="transaction", cascade="all, delete-orphan")

    @property
    def balance_due(self) -> Decimal:
        return (self.total_amount or Decimal(0)) - (self.amount_paid or Decimal(0))


class TransactionPayment(Base):
    __tablename__ = "transaction_payments"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("sales_transactions.id", ondelete="CASCADE"), nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    amount         = Column(Numeric(10, 2), nullable=False)
    payment_date   = Column(Date, nullable=False)
    notes          = Column(Text)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("SaleTransaction", back_populates="payments")


class DailySummary(Base):
    __tablename__ = "daily_summary"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    summary_date = Column(Date, nullable=False, unique=True)

    total_wash_set  = Column(Numeric(10, 2), nullable=False, default=0)
    total_wig_sales = Column(Numeric(10, 2), nullable=False, default=0)
    total_repairs   = Column(Numeric(10, 2), nullable=False, default=0)
    total_other     = Column(Numeric(10, 2), nullable=False, default=0)

    cash_collected     = Column(Numeric(10, 2), nullable=False, default=0)
    quickpay_collected = Column(Numeric(10, 2), nullable=False, default=0)
    cc_collected       = Column(Numeric(10, 2), nullable=False, default=0)
    check_collected    = Column(Numeric(10, 2), nullable=False, default=0)
    zelle_collected    = Column(Numeric(10, 2), nullable=False, default=0)

    new_wigs_sold       = Column(Integer, nullable=False, default=0)
    wigs_paid_full      = Column(Integer, nullable=False, default=0)
    chani_cuts          = Column(Integer, nullable=False, default=0)
    wig_deposits_total  = Column(Numeric(10, 2), nullable=False, default=0)  # deposits received — NOT revenue

    is_locked  = Column(Boolean, nullable=False, default=False)
    notes      = Column(Text)
    entered_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def total_revenue(self) -> Decimal:
        return (
            (self.total_wash_set or 0)
            + (self.total_wig_sales or 0)
            + (self.total_repairs or 0)
            + (self.total_other or 0)
        )


class ExpenseEntry(Base):
    __tablename__ = "expense_entries"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    expense_date = Column(Date, nullable=False)
    category     = Column(Enum(ExpenseCategory), nullable=False)
    amount       = Column(Numeric(10, 2), nullable=False)
    vendor       = Column(String)
    notes        = Column(Text)
    entered_by   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at   = Column(DateTime(timezone=True), server_default=func.now())


class WeeklyPayroll(Base):
    __tablename__ = "weekly_payroll"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    week_start        = Column(Date, nullable=False)
    week_end          = Column(Date, nullable=False)
    employee_id       = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    amount            = Column(Numeric(10, 2), nullable=False)
    pay_type_snapshot = Column(Enum(PayType), nullable=False)
    notes             = Column(Text)
    entered_by        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="payroll_entries")

    __table_args__ = (
        UniqueConstraint("week_start", "employee_id", name="uq_payroll_week_employee"),
    )


class Deposit(Base):
    __tablename__ = "deposits"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deposit_date = Column(Date, nullable=False, unique=True)
    cash         = Column(Numeric(10, 2), nullable=False, default=0)
    checks       = Column(Numeric(10, 2), nullable=False, default=0)
    credit_card  = Column(Numeric(10, 2), nullable=False, default=0)
    zelle        = Column(Numeric(10, 2), nullable=False, default=0)
    notes        = Column(Text)
    entered_by   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def sales_tax_cash(self) -> Decimal:
        return round((self.cash or 0) * Decimal("0.08875"), 2)

    @property
    def sales_tax_cc_other(self) -> Decimal:
        return round(((self.checks or 0) + (self.credit_card or 0) + (self.zelle or 0)) * Decimal("0.045"), 2)


class FinancialSnapshot(Base):
    __tablename__ = "financial_snapshots"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_date = Column(Date, nullable=False, unique=True)

    total_revenue  = Column(Numeric(10, 2), nullable=False, default=0)
    total_expenses = Column(Numeric(10, 2), nullable=False, default=0)
    total_payroll  = Column(Numeric(10, 2), nullable=False, default=0)
    net_profit     = Column(Numeric(10, 2), nullable=False, default=0)

    bank_portion  = Column(Numeric(10, 2), nullable=False, default=0)
    owner_portion = Column(Numeric(10, 2), nullable=False, default=0)

    bank_tithes   = Column(Numeric(10, 2), nullable=False, default=0)
    owner_tithes  = Column(Numeric(10, 2), nullable=False, default=0)
    total_tithes  = Column(Numeric(10, 2), nullable=False, default=0)

    final_take_home = Column(Numeric(10, 2), nullable=False, default=0)
    computed_at     = Column(DateTime(timezone=True), server_default=func.now())


class WigOrder(Base):
    """
    One row = one physical wig sold to a client.
    A wig lives in the business for weeks/months while being prepared.
    Revenue is recognized only when status = paid_in_full.
    Deposits are cash tracking, not revenue.
    """
    __tablename__ = "wig_orders"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    daysmart_serial     = Column(String)           # e.g. "rina44871", "HP33738" — DaySmart's wig ID
    daysmart_receipt_no = Column(String)
    customer_name       = Column(String, nullable=False)
    customer_phone      = Column(String)
    customer_id         = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"))  # future CRM link

    brand       = Column(String)   # RINA, BK, RINA ELITE, etc.
    length      = Column(String)   # 14", 17", 35 CM
    color       = Column(String)   # 2/8, golden, etc.
    size        = Column(String)   # M, S, L
    front       = Column(String)   # Top Lace, etc.

    base_price       = Column(Numeric(10, 2), nullable=False, default=0)
    fill_lace_price  = Column(Numeric(10, 2), nullable=False, default=0)
    total_price      = Column(Numeric(10, 2), nullable=False, default=0)
    amount_paid      = Column(Numeric(10, 2), nullable=False, default=0)

    status      = Column(Enum(WigStatus, name='wig_status'), nullable=False, default=WigStatus.ordered)
    order_date  = Column(Date, nullable=False)
    pickup_date = Column(Date)
    notes       = Column(Text)

    entered_by  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    customer = relationship("Customer", foreign_keys=[customer_id])
    payments = relationship("WigPayment", back_populates="wig_order", cascade="all, delete-orphan")

    @property
    def balance_due(self) -> Decimal:
        return (self.total_price or Decimal(0)) - (self.amount_paid or Decimal(0))


class WigPayment(Base):
    """Each payment event against a WigOrder — deposit, partial, or final."""
    __tablename__ = "wig_payments"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wig_order_id  = Column(UUID(as_uuid=True), ForeignKey("wig_orders.id", ondelete="CASCADE"), nullable=False)
    payment_date  = Column(Date, nullable=False)
    amount        = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(Enum(PaymentMethod, name='payment_method'), nullable=False)
    payment_type  = Column(Enum(WigPaymentType, name='wig_payment_type'), nullable=False, default=WigPaymentType.deposit)
    notes         = Column(Text)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    wig_order = relationship("WigOrder", back_populates="payments")


class BoardPost(Base):
    __tablename__ = "board_posts"

    id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content   = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    author = relationship("User", foreign_keys=[author_id])


class CompanyNotification(Base):
    __tablename__ = "company_notifications"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title          = Column(String, nullable=False)
    body           = Column(Text)
    scheduled_date = Column(Date)
    is_pinned      = Column(Boolean, nullable=False, default=False)
    created_by     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User", foreign_keys=[created_by])


class StaffCheckin(Base):
    __tablename__ = "staff_checkins"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date          = Column(Date, nullable=False, server_default=func.current_date())
    checked_in_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_checkin_user_date"),
    )


class AiConversation(Base):
    __tablename__ = "ai_conversations"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role       = Column(String, nullable=False)  # "user" | "assistant"
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EllaFact(Base):
    __tablename__ = "ella_facts"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category   = Column(String, nullable=False)  # client_note | business_note | reminder | preference
    key        = Column(String, nullable=False)   # short searchable label
    value      = Column(Text, nullable=False)     # the full note
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
