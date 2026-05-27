-- Migration 006: POS Sales — multi-item cart per customer visit
-- Run in Supabase SQL Editor

-- ── 1. pos_item_type enum ─────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE pos_item_type AS ENUM ('wash_set', 'repair', 'inventory', 'wig');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. pos_sales — one row per customer visit ─────────────────
CREATE TABLE IF NOT EXISTS pos_sales (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID          REFERENCES customers(id) ON DELETE SET NULL,
  customer_name  VARCHAR       NOT NULL,
  customer_phone VARCHAR,
  sale_date      DATE          NOT NULL,
  notes          TEXT,
  total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid    NUMERIC(10,2) NOT NULL DEFAULT 0,
  entered_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── 3. pos_sale_items — line items within a visit ─────────────
CREATE TABLE IF NOT EXISTS pos_sale_items (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id       UUID          NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  item_type         pos_item_type NOT NULL,
  description       VARCHAR       NOT NULL,
  quantity          INTEGER       NOT NULL DEFAULT 1,
  unit_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- optional links
  inventory_item_id UUID          REFERENCES inventory_items(id) ON DELETE SET NULL,
  wig_order_id      UUID          REFERENCES wig_orders(id) ON DELETE SET NULL,
  -- wig specs (populated when item_type = 'wig')
  wig_serial        VARCHAR,
  wig_brand         VARCHAR,
  wig_length        VARCHAR,
  wig_color         VARCHAR,
  wig_size          VARCHAR,
  wig_front         VARCHAR,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── 4. pos_sale_payments — how the visit was paid ─────────────
-- payment_method reuses the existing enum (cash, credit_card, quickpay, check, zelle)
CREATE TABLE IF NOT EXISTS pos_sale_payments (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id    UUID          NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  payment_method payment_method NOT NULL,
  amount         NUMERIC(10,2) NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── 5. Indexes for date-range queries ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_pos_sales_date ON pos_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale ON pos_sale_items(pos_sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_payments_sale ON pos_sale_payments(pos_sale_id);
