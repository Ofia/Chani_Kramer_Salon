-- ============================================================
-- Migration 026 — Repair Tasks
-- Adds repair_tasks table for per-task tracking within repair orders.
-- Each task = one service on a wig, with its own status + provider.
-- Cart items are created automatically when a task is saved.
-- Also adds repair_task_id FK to pending_cart_items for clean linking.
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TYPE repair_task_status AS ENUM ('pending', 'in_progress', 'with_external', 'done');

CREATE TABLE repair_tasks (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repair_order_id      UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
    repair_service_id    UUID REFERENCES repair_services(id) ON DELETE SET NULL,
    description          TEXT NOT NULL,
    price                NUMERIC(10, 2) NOT NULL DEFAULT 0,
    tax_rate             NUMERIC(5, 4)  NOT NULL DEFAULT 0.045,
    status               repair_task_status NOT NULL DEFAULT 'pending',
    assigned_provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
    notes                TEXT,
    video_url            TEXT,
    created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pending_cart_items
    ADD COLUMN repair_task_id UUID REFERENCES repair_tasks(id) ON DELETE SET NULL;

CREATE INDEX idx_repair_tasks_order  ON repair_tasks(repair_order_id);
CREATE INDEX idx_repair_tasks_status ON repair_tasks(status);
CREATE INDEX idx_cart_repair_task    ON pending_cart_items(repair_task_id);
