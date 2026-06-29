-- Migration 029: customers — email, split address fields
-- Run in Supabase SQL Editor

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS email    VARCHAR,
ADD COLUMN IF NOT EXISTS address2 VARCHAR,
ADD COLUMN IF NOT EXISTS city     VARCHAR,
ADD COLUMN IF NOT EXISTS state    VARCHAR,
ADD COLUMN IF NOT EXISTS zip_code VARCHAR;
