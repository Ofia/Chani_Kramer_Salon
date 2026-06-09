-- Migration 018: pending_cart_items table
-- Each department adds items to a customer's open cart.
-- Front desk loads the cart at POS checkout and converts it into a pos_sale.

CREATE TYPE cart_item_type AS ENUM ('wig', 'product', 'service');
CREATE TYPE cart_item_status AS ENUM ('pending', 'checked_out', 'cancelled');

CREATE TABLE pending_cart_items (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    item_type         cart_item_type NOT NULL,
    inventory_item_id UUID        REFERENCES inventory_items(id) ON DELETE SET NULL,  -- filled for wig / product items
    description       TEXT        NOT NULL,                                            -- wig name, product name, or service label
    price             NUMERIC(10,2) NOT NULL DEFAULT 0,                               -- agreed price at add time
    tax_rate          NUMERIC(5,4)  NOT NULL DEFAULT 0,                               -- 0 | 0.045 | 0.08875 set at add time
    discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,                               -- flat $ discount (applied at checkout)
    notes             TEXT,
    created_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
    department        TEXT        NOT NULL DEFAULT 'sales',                            -- 'sales' | 'repairs' | 'front_desk'
    status            cart_item_status NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cart_customer ON pending_cart_items (customer_id);
CREATE INDEX idx_cart_status   ON pending_cart_items (status);
CREATE INDEX idx_cart_inv_item ON pending_cart_items (inventory_item_id);
