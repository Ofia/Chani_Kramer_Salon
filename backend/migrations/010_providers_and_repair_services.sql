-- Migration 010 — Providers + Repair Services
-- Run in Supabase SQL Editor

-- ── Provider Type Enum ─────────────────────────────────────────────────────

CREATE TYPE provider_type AS ENUM (
  'wig_company',
  'in_house_repairs',
  'outside_color',
  'in_house_color'
);

-- ── Providers Table ────────────────────────────────────────────────────────

CREATE TABLE providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  provider_type provider_type NOT NULL,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed providers from Avi's list
INSERT INTO providers (name, provider_type) VALUES
  ('Dominga',        'in_house_repairs'),
  ('Roxana',         'in_house_repairs'),
  ('Karla',          'in_house_repairs'),
  ('Rina Wigs',      'wig_company'),
  ('Rochi Lipsker',  'wig_company'),
  ('BK Wigs',        'wig_company'),
  ('Leah Greenfeld', 'outside_color'),
  ('Alla',           'in_house_color');

-- ── Repair Services Table ──────────────────────────────────────────────────

CREATE TABLE repair_services (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed all 28 repair service types
INSERT INTO repair_services (name, sort_order) VALUES
  ('Adding Hair',        1),
  ('Fixing Net',         2),
  ('Lifting Ears',       3),
  ('Patch',              4),
  ('Treatment Lical',    5),
  ('Treatment Company',  6),
  ('Dark Root',          7),
  ('Low Light',          8),
  ('Transfer Cap',       9),
  ('Color Front',       10),
  ('Blended Front',     11),
  ('2 Process Color',   12),
  ('Lining',            13),
  ('Double Lining',     14),
  ('Fold Lace',         15),
  ('Lace Extension',    16),
  ('Lace Front',        17),
  ('Tighten Lace',      18),
  ('Pocket',            19),
  ('Wefts In House',    20),
  ('Wefts',             21),
  ('Change Top',        22),
  ('Money Piece',       23),
  ('Tighten Rubbers',   24),
  ('Change Rubbers',    25),
  ('Add Clips',         26),
  ('Remove Wefts',      27),
  ('Sew Hole',          28);
