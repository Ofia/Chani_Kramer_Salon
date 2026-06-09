-- Migration 017: appointments table for calendar / scheduling
-- Stores all customer appointments across departments.
-- Frontend: CalendarPage (day / week / month views)

CREATE TYPE appointment_department AS ENUM (
    'sales',
    'repairs',
    'wash_set',
    'front_desk'
);

CREATE TYPE appointment_status AS ENUM (
    'scheduled',
    'arrived',
    'in_progress',
    'completed',
    'cancelled',
    'no_show'
);

CREATE TABLE IF NOT EXISTS appointments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name       TEXT NOT NULL,
    customer_phone      TEXT,
    appointment_date    TIMESTAMPTZ NOT NULL,
    duration_minutes    INTEGER NOT NULL DEFAULT 60,
    department          appointment_department NOT NULL,
    services_requested  TEXT,
    status              appointment_status NOT NULL DEFAULT 'scheduled',
    notes               TEXT,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_date       ON appointments (appointment_date);
CREATE INDEX idx_appointments_customer   ON appointments (customer_id);
CREATE INDEX idx_appointments_dept       ON appointments (department);
CREATE INDEX idx_appointments_status     ON appointments (status);
