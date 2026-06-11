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
from sqlalchemy.dialects.postgresql import UUID, JSONB
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

class PayrollStatus(str, enum.Enum):
    pending = "pending"
    paid    = "paid"

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
    rent_facilities         = "rent_facilities"
    utilities               = "utilities"
    supplies_materials      = "supplies_materials"
    cost_of_goods           = "cost_of_goods"
    marketing_advertising   = "marketing_advertising"
    transportation_shipping = "transportation_shipping"
    maintenance_repairs     = "maintenance_repairs"
    food_beverages          = "food_beverages"
    professional_services   = "professional_services"
    taxes_fees              = "taxes_fees"
    charitable_giving       = "charitable_giving"
    reconciliation          = "reconciliation"
    other                   = "other"

class DataSource(str, enum.Enum):
    manual = "manual"
    ai_extracted = "ai_extracted"

class InventoryItemType(str, enum.Enum):
    wig     = "wig"
    product = "product"

class WigItemStatus(str, enum.Enum):
    in_stock             = "in_stock"
    sold                 = "sold"
    on_service           = "on_service"
    damaged              = "damaged"
    returned_to_supplier = "returned_to_supplier"
    transferred          = "transferred"

class InventoryEventType(str, enum.Enum):
    arrived         = "arrived"
    sold            = "sold"
    service         = "service"
    payment_received = "payment_received"
    damaged         = "damaged"
    returned        = "returned"
    transferred     = "transferred"
    note            = "note"

class ProviderType(str, enum.Enum):
    wig_company      = "wig_company"
    in_house_repairs = "in_house_repairs"
    outside_color    = "outside_color"
    in_house_color   = "in_house_color"

class AppointmentDepartment(str, enum.Enum):
    sales      = "sales"
    repairs    = "repairs"
    wash_set   = "wash_set"
    front_desk = "front_desk"

class AppointmentStatus(str, enum.Enum):
    scheduled   = "scheduled"
    arrived     = "arrived"
    in_progress = "in_progress"
    completed   = "completed"
    cancelled   = "cancelled"
    no_show     = "no_show"

class RepairOrderStatus(str, enum.Enum):
    pending       = "pending"
    in_progress   = "in_progress"
    with_external = "with_external"
    ready         = "ready"
    completed     = "completed"

class CartItemType(str, enum.Enum):
    wig     = "wig"
    product = "product"
    service = "service"

class CartItemStatus(str, enum.Enum):
    pending      = "pending"
    checked_out  = "checked_out"
    cancelled    = "cancelled"


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

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    expense_date   = Column(Date, nullable=False)
    category       = Column(Enum(ExpenseCategory), nullable=False)
    amount         = Column(Numeric(10, 2), nullable=False)
    payment_source = Column(String, nullable=False, default='bank')  # 'bank' | 'cash'
    vendor         = Column(String)
    notes          = Column(Text)
    entered_by     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at     = Column(DateTime(timezone=True), server_default=func.now())


class WeeklyPayroll(Base):
    __tablename__ = "weekly_payroll"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    week_start        = Column(Date, nullable=False)
    week_end          = Column(Date, nullable=False)
    employee_id       = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    amount            = Column(Numeric(10, 2), nullable=False)
    cash_amount       = Column(Numeric(10, 2), nullable=False, default=0)
    bank_amount       = Column(Numeric(10, 2), nullable=False, default=0)
    status            = Column(String, nullable=False, default=PayrollStatus.pending)
    paid_at           = Column(DateTime(timezone=True), nullable=True)
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



class WigPayment(Base):
    """Each payment event against an inventory wig item — deposit, partial, or final."""
    __tablename__ = "wig_payments"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False)
    pos_sale_id       = Column(UUID(as_uuid=True), ForeignKey("pos_sales.id", ondelete="SET NULL"), nullable=True)
    payment_date      = Column(Date, nullable=False)
    amount            = Column(Numeric(10, 2), nullable=False)
    payment_method    = Column(Enum(PaymentMethod, name='payment_method'), nullable=False)
    payment_type      = Column(Enum(WigPaymentType, name='wig_payment_type'), nullable=False, default=WigPaymentType.deposit)
    notes             = Column(Text)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    inventory_item = relationship("InventoryItem", back_populates="payments")


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


class PosItemType(str, enum.Enum):
    wash_set  = "wash_set"
    repair    = "repair"
    inventory = "inventory"
    wig       = "wig"


class PosSale(Base):
    """One row per customer visit at the POS — the cart header."""
    __tablename__ = "pos_sales"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id    = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"))
    customer_name  = Column(String, nullable=False)
    customer_phone = Column(String)
    sale_date      = Column(Date, nullable=False)
    notes             = Column(Text)
    total_amount      = Column(Numeric(10, 2), nullable=False, default=0)
    amount_paid       = Column(Numeric(10, 2), nullable=False, default=0)
    tax_rate          = Column(Numeric(5, 4), nullable=False, default=0)
    tax_amount        = Column(Numeric(10, 2), nullable=False, default=0)
    discount_amount   = Column(Numeric(10, 2), nullable=False, default=0)
    shipping_amount   = Column(Numeric(10, 2), nullable=False, default=0)
    shipping_address  = Column(Text)
    entered_by        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    items    = relationship("PosSaleItem",    back_populates="pos_sale", cascade="all, delete-orphan")
    payments = relationship("PosSalePayment", back_populates="pos_sale", cascade="all, delete-orphan")

    @property
    def balance_due(self) -> Decimal:
        return (self.total_amount or Decimal(0)) - (self.amount_paid or Decimal(0))


class PosSaleItem(Base):
    """One line item within a POS sale (service, inventory product, or wig)."""
    __tablename__ = "pos_sale_items"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pos_sale_id       = Column(UUID(as_uuid=True), ForeignKey("pos_sales.id", ondelete="CASCADE"), nullable=False)
    item_type         = Column(Enum(PosItemType, name="pos_item_type"), nullable=False)
    description       = Column(String, nullable=False)
    quantity          = Column(Integer, nullable=False, default=1)
    unit_price        = Column(Numeric(10, 2), nullable=False, default=0)
    subtotal          = Column(Numeric(10, 2), nullable=False, default=0)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="SET NULL"))
    # Wig specs — filled when item_type = 'wig'
    wig_serial        = Column(String)
    wig_brand         = Column(String)
    wig_length        = Column(String)
    wig_color         = Column(String)
    wig_size          = Column(String)
    wig_front         = Column(String)
    notes             = Column(Text)         # repair notes / free-text annotation
    tax_amount        = Column(Numeric(10, 2), nullable=False, default=0)  # per-item tax computed at sale
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    pos_sale = relationship("PosSale", back_populates="items")


class PosSalePayment(Base):
    """A payment record within a POS sale — supports split payments."""
    __tablename__ = "pos_sale_payments"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pos_sale_id    = Column(UUID(as_uuid=True), ForeignKey("pos_sales.id", ondelete="CASCADE"), nullable=False)
    payment_method = Column(Enum(PaymentMethod, name="payment_method"), nullable=False)
    amount         = Column(Numeric(10, 2), nullable=False)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    pos_sale = relationship("PosSale", back_populates="payments")


class InventoryItem(Base):
    """
    Unified inventory — wigs and non-wig products.
    item_type = 'wig'     → serial, brand, specs, cost/retail price, wig_status,
                            plus sale fields (customer, total_price, sale_status …)
    item_type = 'product' → name, category, quantity, unit_price
    """
    __tablename__ = "inventory_items"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_type  = Column(Enum(InventoryItemType, name="inventory_item_type"), nullable=False, default=InventoryItemType.product)

    # ── Shared fields ──
    name       = Column(String, nullable=False)          # product name OR auto-label for wigs
    notes      = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # ── Product-only fields ──
    category   = Column(String)                          # free text, e.g. "Care Products"
    quantity   = Column(Integer, nullable=False, default=0)
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)

    # ── Wig physical fields ──
    daysmart_serial = Column(String, unique=True)        # e.g. "rina44871"
    brand           = Column(String)                     # RINA, BK, Jon Renau, etc.
    color           = Column(String)
    length          = Column(String)
    size            = Column(String)
    front           = Column(String)
    cost_price      = Column(Numeric(10, 2))             # what salon paid/will pay supplier
    markup_pct      = Column(Numeric(5, 2))              # used to auto-calc retail_price
    retail_price    = Column(Numeric(10, 2))             # auto-calc from brand markup, can be overridden
    wig_status      = Column(Enum(WigItemStatus, name="wig_item_status"))
    supplier        = Column(String)
    arrival_date    = Column(Date)
    provider_id     = Column(UUID(as_uuid=True), ForeignKey("providers.id", ondelete="SET NULL"))

    # ── Wig sale fields (filled when wig is sold to a client) ──
    customer_id         = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"))
    customer_name       = Column(String)
    customer_phone      = Column(String)
    total_price         = Column(Numeric(10, 2))         # full sale price agreed with client
    amount_paid         = Column(Numeric(10, 2), nullable=False, default=0)
    sale_status         = Column(Enum(WigStatus, name="wig_status"))  # ordered|ready|paid_in_full
    order_date          = Column(Date)
    pickup_date         = Column(Date)
    daysmart_receipt_no = Column(String)
    additional_charges  = Column(JSONB, nullable=False, default=list)  # [{"label": str, "amount": float}]
    sale_tax_amount     = Column(Numeric(10, 2), nullable=False, default=0)  # tax locked at sale, recognized on pickup_date

    @property
    def balance_due(self) -> Decimal:
        return (self.total_price or Decimal(0)) - (self.amount_paid or Decimal(0))

    events   = relationship("InventoryEvent", back_populates="inventory_item", cascade="all, delete-orphan")
    payments = relationship("WigPayment",     back_populates="inventory_item", cascade="all, delete-orphan")


class BrandMarkup(Base):
    """Markup percentage per wig brand. retail_price = cost_price * (1 + markup_pct/100)."""
    __tablename__ = "brand_markups"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    brand      = Column(String, nullable=False, unique=True)
    markup_pct = Column(Numeric(5, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InventoryEvent(Base):
    """Full history log per inventory item — every meaningful event appended here."""
    __tablename__ = "inventory_events"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False)
    event_type        = Column(Enum(InventoryEventType, name="inventory_event_type"), nullable=False)
    customer_id       = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"))
    pos_sale_id       = Column(UUID(as_uuid=True), ForeignKey("pos_sales.id", ondelete="SET NULL"), nullable=True)
    amount            = Column(Numeric(10, 2))
    description       = Column(Text)
    event_date        = Column(Date, nullable=False, server_default=func.current_date())
    created_by        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    inventory_item = relationship("InventoryItem", back_populates="events")


class EmployeeTimeLog(Base):
    """One row per clock-in event. clock_out is NULL while the employee is still in."""
    __tablename__ = "employee_time_logs"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    clock_in    = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    clock_out   = Column(DateTime(timezone=True), nullable=True)
    date        = Column(Date, nullable=False, server_default=func.current_date())
    logged_by   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes       = Column(Text)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])
    logger   = relationship("User",     foreign_keys=[logged_by])


class Provider(Base):
    """Wig companies, in-house repair staff, and colorists."""
    __tablename__ = "providers"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name          = Column(String, nullable=False)
    provider_type = Column(Enum(ProviderType, name='provider_type'), nullable=False)
    notes         = Column(Text)
    is_active     = Column(Boolean, nullable=False, default=True)
    email         = Column(String)
    phone         = Column(String)
    address       = Column(Text)
    # List of {name: str, markup_usd: float} — wig model markups per provider (flat $ amount)
    wig_models    = Column(JSONB, nullable=False, default=list)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RepairService(Base):
    """Lookup table of repair service types — powers dropdowns in POS/service flows."""
    __tablename__ = "repair_services"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name       = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active  = Column(Boolean, nullable=False, default=True)


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


class Appointment(Base):
    """One row per customer appointment — powers the calendar page."""
    __tablename__ = "appointments"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id        = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_name      = Column(String, nullable=False)
    customer_phone     = Column(String, nullable=True)
    appointment_date   = Column(DateTime(timezone=True), nullable=False)
    duration_minutes   = Column(Integer, nullable=False, default=60)
    department         = Column(Enum(AppointmentDepartment, name="appointment_department"), nullable=False)
    services_requested = Column(Text, nullable=True)
    status             = Column(Enum(AppointmentStatus, name="appointment_status"), nullable=False, default=AppointmentStatus.scheduled)
    notes              = Column(Text, nullable=True)
    created_by         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", foreign_keys=[customer_id])


class RepairOrder(Base):
    """
    A repair job created by the repairs department.
    Services are added to the customer's pending cart linked via repair_order_id.
    Front desk checks out the cart at POS.
    """
    __tablename__ = "repair_orders"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id          = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_name        = Column(Text, nullable=True)
    customer_phone       = Column(Text, nullable=True)
    inventory_item_id    = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="SET NULL"), nullable=True)
    wig_description      = Column(Text, nullable=True)
    notes                = Column(Text, nullable=True)
    video_url            = Column(Text, nullable=True)
    external_provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id", ondelete="SET NULL"), nullable=True)
    status               = Column(Enum(RepairOrderStatus, name="repair_order_status"), nullable=False, default=RepairOrderStatus.pending)
    created_by           = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    customer          = relationship("Customer",       foreign_keys=[customer_id])
    inventory_item    = relationship("InventoryItem",  foreign_keys=[inventory_item_id])
    external_provider = relationship("Provider",       foreign_keys=[external_provider_id])
    creator           = relationship("User",           foreign_keys=[created_by])
    cart_items        = relationship("PendingCartItem", back_populates="repair_order")


class PendingCartItem(Base):
    """
    An item added to a customer's open cart by any department.
    Front desk loads this at POS checkout and converts it into a pos_sale.
    """
    __tablename__ = "pending_cart_items"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id       = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    item_type         = Column(Enum(CartItemType, name="cart_item_type"), nullable=False)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="SET NULL"), nullable=True)
    description       = Column(Text, nullable=False)
    price             = Column(Numeric(10, 2), nullable=False, default=0)
    tax_rate          = Column(Numeric(5, 4), nullable=False, default=0)
    discount_amount   = Column(Numeric(10, 2), nullable=False, default=0)
    notes             = Column(Text)
    created_by        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sales_rep_id      = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    department        = Column(String, nullable=False, default="sales")
    status            = Column(Enum(CartItemStatus, name="cart_item_status"), nullable=False, default=CartItemStatus.pending)
    repair_order_id   = Column(UUID(as_uuid=True), ForeignKey("repair_orders.id", ondelete="SET NULL"), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    customer       = relationship("Customer",      foreign_keys=[customer_id])
    inventory_item = relationship("InventoryItem", foreign_keys=[inventory_item_id])
    creator        = relationship("User",          foreign_keys=[created_by])
    sales_rep      = relationship("Employee",      foreign_keys=[sales_rep_id])
    repair_order   = relationship("RepairOrder",   foreign_keys=[repair_order_id], back_populates="cart_items")
