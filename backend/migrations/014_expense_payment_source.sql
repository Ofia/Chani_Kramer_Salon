-- Migration 014: Add payment_source to expense_entries
-- Tracks whether each expense was paid from Bank or Cash.
-- Default is 'bank' for all existing rows.

ALTER TABLE expense_entries
  ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'bank'
  CHECK (payment_source IN ('bank', 'cash'));
