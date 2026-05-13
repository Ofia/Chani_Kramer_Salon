-- ============================================================
-- Migration: Add ella_facts table
-- Ella's free-form memory — notes that don't fit the schema
-- ============================================================

CREATE TABLE ella_facts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,   -- 'client_note', 'business_note', 'reminder', 'preference'
  key         TEXT NOT NULL,   -- short searchable label, e.g. "Goldstein payment"
  value       TEXT NOT NULL,   -- the actual note
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search index on key + value combined
CREATE INDEX idx_ella_facts_fts
  ON ella_facts
  USING gin(to_tsvector('english', key || ' ' || value));
