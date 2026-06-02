-- Migration 009: Inventory Overhaul
-- Extends inventory_items to support wigs as first-class items.
-- Adds brand_markups (auto retail price from cost) and inventory_events (history log).
-- Run in Supabase SQL Editor.

-- ── New Enums ──────────────────────────────────────────────────────────────

CREATE TYPE inventory_item_type AS ENUM ('wig', 'product');

CREATE TYPE wig_item_status AS ENUM (
    'in_stock',
    'sold',
    'on_service',
    'damaged',
    'returned_to_supplier',
    'transferred'
);

CREATE TYPE inventory_event_type AS ENUM (
    'arrived',
    'sold',
    'service',
    'payment_received',
    'damaged',
    'returned',
    'transferred',
    'note'
);

-- ── Extend inventory_items ─────────────────────────────────────────────────

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS item_type      inventory_item_type NOT NULL DEFAULT 'product',
    ADD COLUMN IF NOT EXISTS daysmart_serial VARCHAR,
    ADD COLUMN IF NOT EXISTS brand          VARCHAR,
    ADD COLUMN IF NOT EXISTS color          VARCHAR,
    ADD COLUMN IF NOT EXISTS length         VARCHAR,
    ADD COLUMN IF NOT EXISTS size           VARCHAR,
    ADD COLUMN IF NOT EXISTS front          VARCHAR,
    ADD COLUMN IF NOT EXISTS cost_price     NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS retail_price   NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS wig_status     wig_item_status,
    ADD COLUMN IF NOT EXISTS supplier       VARCHAR,
    ADD COLUMN IF NOT EXISTS arrival_date   DATE;

-- Unique serial per wig (NULL serials are excluded from uniqueness check)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_serial
    ON inventory_items(daysmart_serial)
    WHERE daysmart_serial IS NOT NULL;

-- ── brand_markups ──────────────────────────────────────────────────────────
-- One row per brand. markup_pct = percentage added on top of cost.
-- e.g. markup_pct = 40.00 means retail = cost * 1.40

CREATE TABLE IF NOT EXISTS brand_markups (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand      VARCHAR NOT NULL UNIQUE,
    markup_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── inventory_events ───────────────────────────────────────────────────────
-- Full history log per inventory item. Every meaningful event appended here.

CREATE TABLE IF NOT EXISTS inventory_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    event_type        inventory_event_type NOT NULL,
    customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
    amount            NUMERIC(10, 2),
    description       TEXT,
    event_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_events_item ON inventory_events(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_events_date ON inventory_events(event_date);
CREATE INDEX IF NOT EXISTS idx_inventory_item_type   ON inventory_items(item_type);
CREATE INDEX IF NOT EXISTS idx_inventory_wig_status  ON inventory_items(wig_status);
