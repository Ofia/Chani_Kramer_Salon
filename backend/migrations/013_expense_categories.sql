-- Migration 013: Standardize expense categories
-- Replaces 14 business-specific labels with 13 industry-standard ones.
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

-- ── Step 1: Create new enum type ─────────────────────────────
CREATE TYPE expensecategory_new AS ENUM (
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

-- ── Step 2: Temporarily hold values as text ──────────────────
ALTER TABLE expense_entries ADD COLUMN category_text TEXT;
UPDATE expense_entries SET category_text = category::text;

-- ── Step 3: Drop old column and enum ─────────────────────────
ALTER TABLE expense_entries DROP COLUMN category;
DROP TYPE expensecategory;

-- ── Step 4: Promote new enum ──────────────────────────────────
ALTER TYPE expensecategory_new RENAME TO expensecategory;

-- ── Step 5: Add new column with default ──────────────────────
ALTER TABLE expense_entries ADD COLUMN category expensecategory NOT NULL DEFAULT 'other';

-- ── Step 6: Map old values → new values ──────────────────────
UPDATE expense_entries SET category = CASE category_text
    WHEN 'itzik'           THEN 'maintenance_repairs'::expensecategory
    WHEN 'grossman'        THEN 'cost_of_goods'::expensecategory
    WHEN 'monsey_driver'   THEN 'transportation_shipping'::expensecategory
    WHEN 'rent'            THEN 'rent_facilities'::expensecategory
    WHEN 'phone_internet'  THEN 'utilities'::expensecategory
    WHEN 'hair_supplies'   THEN 'supplies_materials'::expensecategory
    WHEN 'shipping'        THEN 'transportation_shipping'::expensecategory
    WHEN 'dalia_instagram' THEN 'marketing_advertising'::expensecategory
    WHEN 'misc'            THEN 'other'::expensecategory
    WHEN 'work_purchases'  THEN 'supplies_materials'::expensecategory
    WHEN 'food'            THEN 'food_beverages'::expensecategory
    WHEN 'sales_tax'       THEN 'taxes_fees'::expensecategory
    WHEN 'reconciliation'  THEN 'reconciliation'::expensecategory
    WHEN 'other'           THEN 'other'::expensecategory
    ELSE                        'other'::expensecategory
END;

-- ── Step 7: Clean up temp column ─────────────────────────────
ALTER TABLE expense_entries DROP COLUMN category_text;
