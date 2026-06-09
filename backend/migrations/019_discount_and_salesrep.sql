-- Migration 019: discount on POS sale + sales rep attribution on cart items

-- Flat dollar discount applied at checkout (front desk can override price)
ALTER TABLE pos_sales
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Sales representative who added the item — used later for commission
ALTER TABLE pending_cart_items
    ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES employees(id) ON DELETE SET NULL;
