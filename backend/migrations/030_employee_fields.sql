-- Migration 030: employees — email, timedoc_number, commission_rules
-- Run in Supabase SQL Editor

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS email            VARCHAR,
  ADD COLUMN IF NOT EXISTS timedoc_number   INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS commission_rules JSONB DEFAULT '[]'::jsonb;
