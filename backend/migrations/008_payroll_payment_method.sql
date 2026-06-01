-- Migration 008: Payroll payment method + status
-- Adds cash/bank split, status (pending → paid), and paid_at timestamp.
-- Run in Supabase SQL Editor.

ALTER TABLE weekly_payroll
  ADD COLUMN IF NOT EXISTS cash_amount   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_amount   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status        TEXT           NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending', 'paid')),
  ADD COLUMN IF NOT EXISTS paid_at       TIMESTAMPTZ;
