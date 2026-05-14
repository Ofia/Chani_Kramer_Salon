-- ============================================================
-- Migration 002 — Wig Orders
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. New enum values on existing service_type enum
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'other_wash_set';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'other_reset';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'new_wig_cut';

-- 2. New enums
CREATE TYPE wig_status AS ENUM ('ordered', 'ready', 'paid_in_full');
CREATE TYPE wig_payment_type AS ENUM ('deposit', 'partial', 'final');

-- 3. New column on existing daily_summary table
ALTER TABLE daily_summary
    ADD COLUMN IF NOT EXISTS wig_deposits_total NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 4. wig_orders — one row per physical wig sold
CREATE TABLE IF NOT EXISTS wig_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daysmart_serial     VARCHAR,
    daysmart_receipt_no VARCHAR,
    customer_name       VARCHAR NOT NULL,
    customer_phone      VARCHAR,
    customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
    brand               VARCHAR,
    length              VARCHAR,
    color               VARCHAR,
    size                VARCHAR,
    front               VARCHAR,
    base_price          NUMERIC(10,2) NOT NULL DEFAULT 0,
    fill_lace_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_price         NUMERIC(10,2) NOT NULL DEFAULT 0,
    amount_paid         NUMERIC(10,2) NOT NULL DEFAULT 0,
    status              wig_status NOT NULL DEFAULT 'ordered',
    order_date          DATE NOT NULL,
    pickup_date         DATE,
    notes               TEXT,
    entered_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 5. wig_payments — each payment event against a wig order
CREATE TABLE IF NOT EXISTS wig_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wig_order_id    UUID NOT NULL REFERENCES wig_orders(id) ON DELETE CASCADE,
    payment_date    DATE NOT NULL,
    amount          NUMERIC(10,2) NOT NULL,
    payment_method  payment_method NOT NULL,
    payment_type    wig_payment_type NOT NULL DEFAULT 'deposit',
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Auto-update updated_at on wig_orders
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wig_orders_updated_at
    BEFORE UPDATE ON wig_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
