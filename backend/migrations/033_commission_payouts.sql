-- Migration 033: commission_payouts table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS commission_payouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month             DATE NOT NULL,
  calculated_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  adjustment_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  final_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  paid_at           TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, month)
);
