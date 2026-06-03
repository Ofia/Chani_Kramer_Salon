-- Migration 011: Consolidate wig_orders into inventory_items
-- Goal: one source of truth for wigs. inventory_items IS the wig record.
-- wig_orders table is removed. wig_payments FK moves to inventory_item_id.
-- Run in Supabase SQL Editor.

-- ─────────────────────────────────────────────────────────────
-- STEP 1 — Add sale columns to inventory_items
-- These were previously on wig_orders; now live on the wig inventory row.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS customer_id         UUID         REFERENCES customers(id)  ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS customer_name        VARCHAR,
    ADD COLUMN IF NOT EXISTS customer_phone       VARCHAR,
    ADD COLUMN IF NOT EXISTS total_price          NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS amount_paid          NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sale_status          wig_status,   -- ordered | ready | paid_in_full
    ADD COLUMN IF NOT EXISTS order_date           DATE,
    ADD COLUMN IF NOT EXISTS pickup_date          DATE,
    ADD COLUMN IF NOT EXISTS daysmart_receipt_no  VARCHAR,
    ADD COLUMN IF NOT EXISTS additional_charges   JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS provider_id          UUID         REFERENCES providers(id)  ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS markup_pct           NUMERIC(5, 2);

-- ─────────────────────────────────────────────────────────────
-- STEP 2 — Migrate data from wig_orders → inventory_items
-- ─────────────────────────────────────────────────────────────

-- 2a. Temp helper: add _src_order_id to inventory_items so we can back-link
--     wig_payments later without needing the wig_orders table to still exist.
ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS _src_order_id UUID;

-- 2b. Update existing inventory_items rows that match by daysmart_serial
UPDATE inventory_items AS inv
SET
    customer_id        = wo.customer_id,
    customer_name      = wo.customer_name,
    customer_phone     = wo.customer_phone,
    total_price        = wo.total_price,
    amount_paid        = wo.amount_paid,
    sale_status        = wo.status,
    order_date         = wo.order_date,
    pickup_date        = wo.pickup_date,
    daysmart_receipt_no = wo.daysmart_receipt_no,
    additional_charges = (
        CASE
            -- fold fill_lace_price into the JSONB array if it was > 0
            WHEN wo.fill_lace_price > 0
            THEN COALESCE(wo.additional_charges, '[]'::jsonb)
                 || jsonb_build_array(
                        jsonb_build_object('label', 'Fill Lace', 'amount', wo.fill_lace_price)
                    )
            ELSE COALESCE(wo.additional_charges, '[]'::jsonb)
        END
    ),
    _src_order_id      = wo.id
FROM wig_orders AS wo
WHERE inv.daysmart_serial = wo.daysmart_serial
  AND inv.item_type = 'wig'
  AND inv.daysmart_serial IS NOT NULL;

-- 2c. Insert orphaned wig_orders (no matching inventory row)
--     These are wigs that exist in wig_orders but were never added to inventory.
INSERT INTO inventory_items (
    id,
    item_type,
    name,
    daysmart_serial,
    brand,
    color,
    length,
    size,
    front,
    customer_id,
    customer_name,
    customer_phone,
    total_price,
    amount_paid,
    sale_status,
    order_date,
    pickup_date,
    daysmart_receipt_no,
    additional_charges,
    notes,
    _src_order_id,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'wig',
    -- auto-label: "Brand Serial" or just customer name if no serial
    COALESCE(wo.brand || ' ' || wo.daysmart_serial, wo.brand, wo.customer_name || '''s Wig', 'Wig'),
    wo.daysmart_serial,
    wo.brand,
    wo.color,
    wo.length,
    wo.size,
    wo.front,
    wo.customer_id,
    wo.customer_name,
    wo.customer_phone,
    wo.total_price,
    wo.amount_paid,
    wo.status,
    wo.order_date,
    wo.pickup_date,
    wo.daysmart_receipt_no,
    (
        CASE
            WHEN wo.fill_lace_price > 0
            THEN COALESCE(wo.additional_charges, '[]'::jsonb)
                 || jsonb_build_array(
                        jsonb_build_object('label', 'Fill Lace', 'amount', wo.fill_lace_price)
                    )
            ELSE COALESCE(wo.additional_charges, '[]'::jsonb)
        END
    ),
    wo.notes,
    wo.id,
    wo.created_at,
    wo.updated_at
FROM wig_orders AS wo
WHERE wo.daysmart_serial IS NULL
   OR wo.daysmart_serial NOT IN (
       SELECT daysmart_serial
       FROM   inventory_items
       WHERE  daysmart_serial IS NOT NULL
   );

-- ─────────────────────────────────────────────────────────────
-- STEP 3 — Migrate wig_payments FK
-- wig_payments.wig_order_id → wig_payments.inventory_item_id
-- ─────────────────────────────────────────────────────────────

-- 3a. Add new FK column
ALTER TABLE wig_payments
    ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE;

-- 3b. Fill it using the temp helper column we set above
UPDATE wig_payments AS wp
SET    inventory_item_id = inv.id
FROM   inventory_items AS inv
WHERE  inv._src_order_id = wp.wig_order_id;

-- 3c. Drop the old FK column from wig_payments
ALTER TABLE wig_payments
    DROP COLUMN IF EXISTS wig_order_id;

-- 3d. Make inventory_item_id NOT NULL now that it's populated
ALTER TABLE wig_payments
    ALTER COLUMN inventory_item_id SET NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 4 — Clean up pos_sale_items
-- wig_order_id was SET NULL FK; just drop the column.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_sale_items
    DROP COLUMN IF EXISTS wig_order_id;

-- ─────────────────────────────────────────────────────────────
-- STEP 5 — Drop temp helper column, then drop wig_orders
-- ─────────────────────────────────────────────────────────────

ALTER TABLE inventory_items
    DROP COLUMN IF EXISTS _src_order_id;

DROP TABLE IF EXISTS wig_orders CASCADE;

-- ─────────────────────────────────────────────────────────────
-- STEP 6 — Indexes
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inventory_sale_status
    ON inventory_items(sale_status)
    WHERE sale_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_customer
    ON inventory_items(customer_id)
    WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wig_payments_item
    ON wig_payments(inventory_item_id);
