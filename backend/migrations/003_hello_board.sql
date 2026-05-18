-- Migration 003 — Hello Board
-- Run this in the Supabase SQL Editor

-- Thread posts (Twitter-style announcements)
CREATE TABLE board_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Company notifications (scheduled / pinned notices)
CREATE TABLE company_notifications (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title          TEXT NOT NULL,
    body           TEXT,
    scheduled_date DATE,
    is_pinned      BOOLEAN NOT NULL DEFAULT FALSE,
    created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Daily staff check-ins (one row per user per day)
CREATE TABLE staff_checkins (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date          DATE NOT NULL DEFAULT CURRENT_DATE,
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
