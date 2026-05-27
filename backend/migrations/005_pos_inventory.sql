-- Migration 005: POS additional charges + inventory items
-- Run in Supabase SQL Editor

-- ── 1. Add additional_charges to wig_orders ──────────────────
-- Stores a JSON array of extra line items, e.g.:
-- [{"label": "Color roots", "amount": 150.00}, {"label": "Line the laces", "amount": 75.00}]
ALTER TABLE wig_orders
  ADD COLUMN IF NOT EXISTS additional_charges JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── 2. Create inventory_items table ──────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR        NOT NULL,
  category     VARCHAR,                          -- e.g. "Care Products", "Accessories", "Tools"
  quantity     INTEGER        NOT NULL DEFAULT 0,
  unit_price   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory_items;
CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();
