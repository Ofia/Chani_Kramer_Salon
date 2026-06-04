-- Migration 013: Standardize expense categories
-- Replaces 14 business-specific labels with 13 industry-standard ones.
--
-- This version avoids relying on the old enum type name by converting
-- the column to TEXT first, then casting to the new enum type.
--
-- Old → New mapping:
--   itzik           → maintenance_repairs
--   grossman        → cost_of_goods
--   monsey_driver   → transportation_shipping
--   rent            → rent_facilities
--   phone_internet  → utilities
--   hair_supplies   → supplies_materials
--   shipping        → transportation_shipping
--   dalia_instagram → marketing_advertising
--   misc            → other
--   work_purchases  → supplies_materials
--   food            → food_beverages
--   sales_tax       → taxes_fees
--   reconciliation  → reconciliation  (unchanged)
--   other           → other           (unchanged)
--
-- Also adds: charitable_giving (מעשרות), professional_services
--
-- Run in Supabase SQL Editor.

-- ── Step 1: Convert existing column to plain text ─────────────
-- (Works regardless of what the old enum type was named)
ALTER TABLE expense_entries ALTER COLUMN category TYPE TEXT;

-- ── Step 2: Map old values → new values ──────────────────────
UPDATE expense_entries SET category = CASE category
    WHEN 'itzik'           THEN 'maintenance_repairs'
    WHEN 'grossman'        THEN 'cost_of_goods'
    WHEN 'monsey_driver'   THEN 'transportation_shipping'
    WHEN 'rent'            THEN 'rent_facilities'
    WHEN 'phone_internet'  THEN 'utilities'
    WHEN 'hair_supplies'   THEN 'supplies_materials'
    WHEN 'shipping'        THEN 'transportation_shipping'
    WHEN 'dalia_instagram' THEN 'marketing_advertising'
    WHEN 'misc'            THEN 'other'
    WHEN 'work_purchases'  THEN 'supplies_materials'
    WHEN 'food'            THEN 'food_beverages'
    WHEN 'sales_tax'       THEN 'taxes_fees'
    WHEN 'reconciliation'  THEN 'reconciliation'
    WHEN 'other'           THEN 'other'
    ELSE                        'other'
END;

-- ── Step 3: Create new enum type ─────────────────────────────
CREATE TYPE expensecategory AS ENUM (
    'rent_facilities',
    'utilities',
    'supplies_materials',
    'cost_of_goods',
    'marketing_advertising',
    'transportation_shipping',
    'maintenance_repairs',
    'food_beverages',
    'professional_services',
    'taxes_fees',
    'charitable_giving',
    'reconciliation',
    'other'
);

-- ── Step 4: Cast column back to the new enum ──────────────────
ALTER TABLE expense_entries
    ALTER COLUMN category TYPE expensecategory
    USING category::expensecategory;
