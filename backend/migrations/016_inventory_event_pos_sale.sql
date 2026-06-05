-- Migration 016: link inventory_events back to the pos_sale that created them
-- Allows clean deletion of history log entries when a POS sale is deleted.

ALTER TABLE inventory_events
  ADD COLUMN IF NOT EXISTS pos_sale_id UUID REFERENCES pos_sales(id) ON DELETE SET NULL;
