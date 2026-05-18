-- Migration 004: Add access_id to customers table
-- access_id = the original row ID from the Access/Sheitel.mdb database
-- Used for upsert-based incremental imports without creating duplicates
-- Run in Supabase SQL Editor

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS access_id INTEGER UNIQUE;

-- Index for fast upsert lookups
CREATE INDEX IF NOT EXISTS idx_customers_access_id ON customers(access_id);
