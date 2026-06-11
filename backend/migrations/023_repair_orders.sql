    -- Migration 023: repair_orders table
    -- Tracks a repair job from intake through completion.
    -- Services are stored in pending_cart_items with department='repairs' + repair_order_id FK.

    CREATE TYPE repair_order_status AS ENUM (
        'pending',       -- just created, awaiting work
        'in_progress',   -- being worked on in-house
        'with_external', -- sent to an external provider
        'ready',         -- done, awaiting customer pickup + payment
        'completed'      -- paid and picked up (via POS)
    );

    CREATE TABLE repair_orders (
        id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id           UUID        REFERENCES customers(id)        ON DELETE SET NULL,
        customer_name         TEXT,
        customer_phone        TEXT,
        inventory_item_id     UUID        REFERENCES inventory_items(id)  ON DELETE SET NULL,
        wig_description       TEXT,                          -- for wigs not in our system
        notes                 TEXT,
        video_url             TEXT,                          -- link to video (WhatsApp / Drive)
        external_provider_id  UUID        REFERENCES providers(id)        ON DELETE SET NULL,
        status                repair_order_status NOT NULL DEFAULT 'pending',
        created_by            UUID        REFERENCES users(id)            ON DELETE SET NULL,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_repair_orders_customer ON repair_orders (customer_id);
    CREATE INDEX idx_repair_orders_status   ON repair_orders (status);

    -- Link pending_cart_items to the repair order they belong to
    ALTER TABLE pending_cart_items
        ADD COLUMN IF NOT EXISTS repair_order_id UUID REFERENCES repair_orders(id) ON DELETE SET NULL;

    CREATE INDEX idx_cart_repair_order ON pending_cart_items (repair_order_id);
