-- Migration 015: per-item tax support
--
-- 1. inventory_items.sale_tax_amount
--    Stores the tax obligation for a wig at time of sale.
--    Recognized as "tax collected" only when sale_status = paid_in_full (pickup_date).
--
-- 2. pos_sale_items.tax_amount
--    Stores the computed tax for each line item so reports can split
--    wig tax (deferred) from service/product tax (immediate).

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS sale_tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE pos_sale_items
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
