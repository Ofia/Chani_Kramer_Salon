-- Migration 032: overtime_after_hours on employees
-- Run in Supabase SQL Editor

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS overtime_after_hours INTEGER;
