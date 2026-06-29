-- Migration 028: appointment employee assignment + employee department field
-- Run in Supabase SQL Editor

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS department VARCHAR;
