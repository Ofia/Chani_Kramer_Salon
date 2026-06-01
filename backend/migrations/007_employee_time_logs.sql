-- Migration 007: Employee Time Logs
-- Clock-in / clock-out tracking per employee (not per user).
-- Week definition: Wednesday → Tuesday (paid on Thursdays).
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS employee_time_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    clock_in    TIMESTAMPTZ NOT NULL DEFAULT now(),
    clock_out   TIMESTAMPTZ,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    logged_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_logs_employee ON employee_time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_date     ON employee_time_logs(date);
