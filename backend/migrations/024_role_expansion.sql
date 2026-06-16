-- ============================================================
-- Migration 024 — Role Expansion
-- Adds sales, front_desk, repairs to the user_role enum
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'front_desk';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'repairs';
