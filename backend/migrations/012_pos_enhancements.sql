-- Migration 012: POS Enhancements
-- Adds: repair notes on line items, sales tax, shipping amount + address on sales.
-- Run in Supabase SQL Editor.

-- ── pos_sale_items — repair notes ─────────────────────────────
ALTER TABLE pos_sale_items
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- ── pos_sales — tax + shipping ────────────────────────────────
ALTER TABLE pos_sales
    ADD COLUMN IF NOT EXISTS tax_rate         NUMERIC(5, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount       NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shipping_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shipping_address TEXT;
