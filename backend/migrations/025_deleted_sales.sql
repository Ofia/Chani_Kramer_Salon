-- Migration 025: deleted_sales audit table
-- Captures a full snapshot of every POS sale before it is hard-deleted,
-- so the "Deleted Sales" tab can display what was in the sale + why it was removed.

CREATE TABLE IF NOT EXISTS deleted_sales (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    original_sale_id  UUID,                                              -- the old pos_sale id (no FK — sale is gone)
    sale_date         DATE        NOT NULL,
    customer_name     TEXT,
    customer_id       UUID        REFERENCES customers(id) ON DELETE SET NULL,
    total_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
    deletion_reason   TEXT        NOT NULL,
    deleted_by_name   TEXT,                                              -- denormalized; user may later be removed
    deleted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    items_snapshot    JSONB       NOT NULL DEFAULT '[]',
    payments_snapshot JSONB       NOT NULL DEFAULT '[]'
);
