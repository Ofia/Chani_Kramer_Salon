-- Migration 027 — Wash & Set services lookup + stylist attribution on final sales
-- Run in Supabase SQL Editor

-- ── Wash & Set Services Table ─────────────────────────────────────────────────

CREATE TABLE wash_set_services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  default_price NUMERIC(10,2),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO wash_set_services (name, sort_order) VALUES
  ('Wash & Set',         0),
  ('Reset',              1),
  ('Wash Only',          2),
  ('Dark Roots',         3),
  ('Lowlights',          4),
  ('Fix Cut',            5),
  ('Finish Cut',         6),
  ('Lining',             7),
  ('Fill Lace',          8),
  ('Lace Band',          9),
  ('New Wig Cut',        10),
  ('Chani Wash & Set',   11),
  ('Other Wash & Set',   12),
  ('Other Reset',        13);

-- ── Stylist attribution on the final sale (was only on pending_cart_items
-- before, and got dropped at checkout — see migration 019) ──────────────────

ALTER TABLE pos_sale_items
    ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES employees(id) ON DELETE SET NULL;
