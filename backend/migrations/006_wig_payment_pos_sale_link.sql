-- Migration 006: Link wig_payments to pos_sales to prevent auto-fill double-counting
-- Run in Supabase SQL Editor

-- When a wig balance payment is recorded through the POS flow (POST /pos-sales/),
-- we stamp pos_sale_id on the WigPayment record. The auto-fill query then uses
-- this column to exclude those payments from the direct_wig_pmts loop — they are
-- already captured via the PosSale's payment records.
ALTER TABLE wig_payments
  ADD COLUMN IF NOT EXISTS pos_sale_id UUID REFERENCES pos_sales(id) ON DELETE SET NULL;
