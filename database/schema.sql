-- ============================================================
-- Chani Kramer Wigs Salon — PostgreSQL Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('bookkeeper', 'owner');

CREATE TYPE pay_type AS ENUM ('weekly_flat', 'commission_pct', 'hourly');

CREATE TYPE payment_method AS ENUM ('cash', 'credit_card', 'quickpay', 'check', 'zelle');

CREATE TYPE service_type AS ENUM (
  'wig_sale',
  'wash_set',
  'repair',
  'fill_lace',
  'lining',
  'dark_roots',
  'lowlights',
  'fix_cut',
  'finish_cut',
  'reset',
  'wash_only',
  'shipping',
  'bf_sale',
  'lace_band',
  'chani_wash_set',
  'other'
);

CREATE TYPE expense_category AS ENUM (
  'itzik',
  'grossman',
  'monsey_driver',
  'rent',
  'phone_internet',
  'hair_supplies',
  'shipping',
  'dalia_instagram',
  'misc',
  'work_purchases',
  'food',
  'sales_tax',
  'reconciliation',
  'other'
);

CREATE TYPE data_source AS ENUM ('manual', 'ai_extracted');

-- ────────────────────────────────────────────────────────────
-- 1. USERS
-- Linked to Supabase auth.users via supabase_uid
-- ────────────────────────────────────────────────────────────

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid UUID UNIQUE NOT NULL,  -- from Supabase auth
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  role        user_role NOT NULL DEFAULT 'bookkeeper',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. EMPLOYEES
-- All staff: stylists, front desk, maintenance, social media, etc.
-- ────────────────────────────────────────────────────────────

CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  job_title       TEXT NOT NULL,            -- free text: "stylist", "front desk", "cleaner"
  pay_type        pay_type NOT NULL,
  weekly_rate     NUMERIC(10,2),             -- for weekly_flat
  commission_rate NUMERIC(5,4),             -- for commission_pct (e.g. 0.35 = 35%)
  hourly_rate     NUMERIC(10,2),            -- for hourly
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  hired_at        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 3. CUSTOMERS
-- Salon clients — linked to DaySmart client numbers
-- ────────────────────────────────────────────────────────────

CREATE TABLE customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  phone               TEXT,
  cell                TEXT,
  address             TEXT,
  daysmart_client_id  TEXT UNIQUE,          -- their existing client # in DaySmart
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. SALES TRANSACTIONS
-- One row per receipt — individual wig sales and services
-- ────────────────────────────────────────────────────────────

CREATE TABLE sales_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number  TEXT,                     -- DaySmart receipt #
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL,
  service_type    service_type NOT NULL,
  is_chani_service BOOLEAN NOT NULL DEFAULT FALSE,  -- Chani (owner) performed the service

  -- Wig specs (nullable — only for wig sales)
  wig_brand       TEXT,                     -- RINA, BK, Rochi Lipsker, etc.
  wig_model       TEXT,
  wig_length      TEXT,
  wig_color       TEXT,
  wig_size        TEXT,
  wig_front       TEXT,

  -- Financials
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due     NUMERIC(10,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,

  notes           TEXT,
  source          data_source NOT NULL DEFAULT 'manual',
  entered_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 5. TRANSACTION PAYMENTS
-- Installment payments against a single sale
-- ────────────────────────────────────────────────────────────

CREATE TABLE transaction_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  payment_method  payment_method NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  payment_date    DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 6. DAILY SUMMARY
-- Tzipora's rolled-up daily entry — feeds the financial engine
-- ────────────────────────────────────────────────────────────

CREATE TABLE daily_summary (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date    DATE NOT NULL UNIQUE,

  -- Revenue by stream
  total_wash_set  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_wig_sales NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_repairs   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_other     NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Cash received today by method
  cash_collected      NUMERIC(10,2) NOT NULL DEFAULT 0,
  quickpay_collected  NUMERIC(10,2) NOT NULL DEFAULT 0,
  cc_collected        NUMERIC(10,2) NOT NULL DEFAULT 0,
  check_collected     NUMERIC(10,2) NOT NULL DEFAULT 0,
  zelle_collected     NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Counts
  new_wigs_sold   INTEGER NOT NULL DEFAULT 0,
  wigs_paid_full  INTEGER NOT NULL DEFAULT 0,
  chani_cuts      INTEGER NOT NULL DEFAULT 0,

  -- Status
  is_locked       BOOLEAN NOT NULL DEFAULT FALSE,  -- locked = finalized, no edits
  notes           TEXT,
  entered_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 7. EXPENSE ENTRIES
-- All non-payroll expenses, normalized (one row per entry)
-- ────────────────────────────────────────────────────────────

CREATE TABLE expense_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date    DATE NOT NULL,
  category        expense_category NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  vendor          TEXT,
  notes           TEXT,
  entered_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 8. WEEKLY PAYROLL
-- Pay per employee per week
-- ────────────────────────────────────────────────────────────

CREATE TABLE weekly_payroll (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start          DATE NOT NULL,
  week_end            DATE NOT NULL,
  employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  amount              NUMERIC(10,2) NOT NULL,
  pay_type_snapshot   pay_type NOT NULL,     -- what type was used at time of payment
  notes               TEXT,
  entered_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(week_start, employee_id)            -- one entry per employee per week
);

-- ────────────────────────────────────────────────────────────
-- 9. DEPOSITS
-- Daily bank deposit reconciliation
-- ────────────────────────────────────────────────────────────

CREATE TABLE deposits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_date    DATE NOT NULL UNIQUE,
  cash            NUMERIC(10,2) NOT NULL DEFAULT 0,
  checks          NUMERIC(10,2) NOT NULL DEFAULT 0,
  credit_card     NUMERIC(10,2) NOT NULL DEFAULT 0,
  zelle           NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Sales tax auto-calculated (stored for verification)
  -- Cash: 8.875%, CC/Checks/Zelle: 4.5%
  sales_tax_cash        NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(cash * 0.08875, 2)) STORED,
  sales_tax_cc_other    NUMERIC(10,2) GENERATED ALWAYS AS (ROUND((checks + credit_card + zelle) * 0.045, 2)) STORED,

  notes           TEXT,
  entered_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 10. FINANCIAL SNAPSHOTS
-- Computed daily — output of all business logic
-- Recalculated whenever daily_summary, expenses, or payroll change
-- ────────────────────────────────────────────────────────────

CREATE TABLE financial_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date       DATE NOT NULL UNIQUE,

  -- Revenue & expenses
  total_revenue       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_expenses      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_payroll       NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_profit          NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- 40% bank rule
  bank_portion        NUMERIC(10,2) NOT NULL DEFAULT 0,  -- net_profit * 0.40
  owner_portion       NUMERIC(10,2) NOT NULL DEFAULT 0,  -- net_profit * 0.60

  -- Tithes (מעשרות)
  -- bank_tithes  = (bank_portion * 0.91125) / 10  (strip 8.875% tax first, then 10%)
  -- owner_tithes = owner_portion / 10
  bank_tithes         NUMERIC(10,2) NOT NULL DEFAULT 0,
  owner_tithes        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_tithes        NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Final result
  final_take_home     NUMERIC(10,2) NOT NULL DEFAULT 0,

  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 11. AI CONVERSATIONS
-- Chatbot history per user
-- ────────────────────────────────────────────────────────────

CREATE TABLE ai_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES — for common query patterns
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_sales_transactions_date     ON sales_transactions(transaction_date);
CREATE INDEX idx_sales_transactions_customer ON sales_transactions(customer_id);
CREATE INDEX idx_expense_entries_date        ON expense_entries(expense_date);
CREATE INDEX idx_expense_entries_category    ON expense_entries(category);
CREATE INDEX idx_weekly_payroll_week         ON weekly_payroll(week_start);
CREATE INDEX idx_weekly_payroll_employee     ON weekly_payroll(employee_id);
CREATE INDEX idx_financial_snapshots_date    ON financial_snapshots(snapshot_date);
CREATE INDEX idx_ai_conversations_user       ON ai_conversations(user_id);
CREATE INDEX idx_transaction_payments_txn    ON transaction_payments(transaction_id);
