-- Migration 021: Add contact info + wig models to providers

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS address    TEXT,
  ADD COLUMN IF NOT EXISTS wig_models JSONB NOT NULL DEFAULT '[]'::jsonb;
