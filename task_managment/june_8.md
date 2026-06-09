# June 8 — Avi Meeting Notes

## Raw Meeting Notes (Verbatim)

As we already understood, the wig lifecycle is one of the main sources of truth. It arrives to the inventory, and many things can happen to it over the course of its existence — even after it's sold, the client still comes back to take care of it.

Another source of truth is the customer. They come through the calendar and have sometimes many wigs in different statuses, which means they are a center point of information regarding several wigs and their processes.

---

## Department-Based Restructure

We are making changes in the structure of the app based on departments:

- **Sales** — sales management and inventory
- **Repairs** — repairs management (stores all info requested by client, coordinates all work: color, adding hair, etc. — work can happen in different locations, so the wig can travel until ready for pickup)
- **W&S** — handled by front desk
- **Front Desk** — POS, calendar, client status / check-in / check-out
- **Bookkeeping**
- **Owner**

Each department creates an item that can be added to the customer's cart (new wig, W&S service, repair for new/old wig, etc.). Once created and added to the cart, the customer goes to the cashier (front desk) who manages payment via POS.

**Mental model: Amazon in the physical world.** You scroll around the salon adding items to your cart, then manage everything at the checkout page.

---

## Example Flow — New Customer Wig Sale

1. Customer calls front desk → books consultation with Sales
2. Front desk adds customer → creates calendar appointment
3. Customer arrives → sits in showroom with salesperson
4. Salesperson opens inventory → verifies wig info
5. Salesperson creates new wig item for that customer on Sales Management page (agrees on price, services, etc.) → clicks **Add to Cart**
6. Customer walks to front desk
7. Front desk opens customer profile → goes to their cart (POS) → checks them out (all existing rules apply)

The sale is recorded in:
- The wig's history log
- The customer's profile (linked via wig serial number)

---

## Repairs Flow

- Repairs department finds the customer's wig in inventory history under Sold Items
- OR adds a new serial number if the wig was sold before the system was implemented (starting a fresh log on that wig)

---

## Page / Structure Changes

- **Inventory page** → renamed to **Product Management**
  - Tabs: **Inventory** (stock) | **Sold Items**

---

## Smaller Issues (Raw)

1. We need to add a commission flow for salespeople and W&S stylists. Commissions need to be added to their payroll but also removed if a sale is cancelled. It is part of the wig's lifecycle: "commission added to sales person", "sale canceled", "item returned to inventory", "commission removed from sales person".

2. In the POS, once a product is added, no need to be able to edit the price (the price comes from the inventory) — only add a discount field instead.

3. In the Overview page there is a bug in the payment tab — it adds up numbers incorrectly.

4. If a deposit was paid for a wig but it was never picked up (abandoned by customer) — there's no deposit refund policy. We have to remove the deposit from the wig, return the wig to inventory, and add the deposit to revenue as a misc item.

5. We need to wire up the product/wig status to the sale of it. It's visible in the log history but the status doesn't change automatically. Also, a sold wig or item should be moved from the Inventory tab into the Sold Items tab.

6. In the POS we don't need edit mode for the wig's details. This is done in Inventory when items are added — Sales and Front Desk should not be able to edit color, length, size, etc.

---

## Summary, Plan & Tasks

---

### The Big Picture

This is not a bookkeeper tool. It is a **full salon operating system** — replacing DaySmart (scheduling/POS), Access (CRM), QuickBooks (bookkeeping), and all manual work, in one unified platform.

**Two sources of truth:**
1. **The Wig** — has a lifecycle from arrival to post-sale service. Every event is logged.
2. **The Customer** — links to multiple wigs in multiple statuses simultaneously.

**Core model shift:** Each department creates items → items go into a customer's cart → Front Desk (POS) checks them out. Amazon in the physical world.

---

### Rebuild vs. Modify

**Modify. Not rebuild.**

The database schema (~80% stays), business logic (cart, tax, wig payments, tithes, payroll), and backend routes are solid. What changes is the application layer: routing, navigation, roles, and new features. This is a major renovation, not a teardown.

---

### Architecture Changes

#### 1. Role System (Backend)
Add 4 new roles to `UserRole` enum:
- `sales` — Sales department (wig consultations, product management)
- `repairs` — Repairs department (repair tracking, coordination)
- `front_desk` — Front Desk (POS, calendar, check-in/out)
- `bookkeeper` (existing) — Payroll, expenses, reports
- `owner` (existing) — Everything + owner dashboard

Currently only `bookkeeper` and `owner` exist in the backend. The frontend already has placeholders for all 5.

#### 2. Department-Based Routing (Frontend)
Replace the single `/bookkeeper/*` layout with department layouts:

```
/sales/*          → Sales: Sales Management, Product Management, Customers
/repairs/*        → Repairs: Repair Tracking
/front-desk/*     → Front Desk: POS, Calendar, Hello Board, Clock-in/out
/bookkeeping/*    → Bookkeeping: Payroll, Expenses, Overview
/owner/*          → Owner: Super Board
```

Add redirect aliases from old `/bookkeeper/*` routes to prevent broken links.

#### 3. Customer Cart (New Feature)
Departments need to add items to a **pending/open cart** for a customer before they reach the POS. This is the "Amazon" model.

- New concept: `PendingCart` — an unsaved cart attached to a customer
- Sales dept creates a wig item → adds to customer's pending cart
- Front Desk opens POS → loads customer → sees pending cart → checks out
- Cart can have items from multiple departments
- POS becomes a checkout layer, not an item creation layer

This likely needs a new table: `pending_cart_items` (customer_id, item_type, details, created_by_dept, created_at) — or can use a temporary session approach.

#### 4. Inventory → Product Management
- Rename page to **Product Management**
- Tab 1: **Inventory** (in_stock wigs + products — unchanged)
- Tab 2: **Sold Items** (wigs with wig_status = sold; products with qty = 0)
- When a wig is sold via POS → automatically moves from Inventory tab to Sold Items tab
- Status must update automatically (currently manual)

---

### New Features to Build

#### Feature A: Commission System
- Per-employee commission % (stored on `Employee.commission_rate` — field exists for commission_pct pay type)
- Commission events are part of the wig lifecycle:
  - "Commission added to [salesperson]" → when wig is sold
  - "Sale canceled" → when sale is voided
  - "Item returned to inventory" → wig_status reset to in_stock
  - "Commission removed from [salesperson]" → commission reversed
- Commissions feed into payroll (added as a line item on WeeklyPayroll)
- Need new table: `commission_entries` (employee_id, inventory_item_id, pos_sale_id, amount, status: active|reversed, event_date)
- Commission % applies to: wig sale price (for salesperson), service price (for W&S stylist)

#### Feature B: Abandoned Deposit Flow
When a customer paid a deposit but never picked up the wig:
1. User clicks "Mark as Abandoned" on the wig order
2. System:
   - Removes the wig from the customer (clears customer_id, sale_status, etc.)
   - Returns wig to inventory (wig_status → in_stock)
   - Converts the deposit amount into misc revenue (creates a revenue record)
   - Logs event: "Sale abandoned — deposit forfeited — returned to inventory"
3. New backend endpoint: `POST /inventory/{id}/abandon-sale`
4. No new tables needed — handled via status updates + a new ExpenseCategory or misc revenue type

#### Feature C: Auto Status + Tab Sync
When a wig is sold via POS:
- `wig_status` must auto-update to `sold` immediately (this is currently broken)
- Wig must disappear from Inventory tab and appear in Sold Items tab
- Fix: backend's `pos_sales.py` must explicitly set `inventory_item.wig_status = 'sold'` on sale creation
- Same logic on sale deletion: revert `wig_status` based on remaining payments

---

### POS Cleanup (Small but Important)

1. **Remove price editing on inventory products** — price comes from inventory, locked. Replace with **discount field** (flat $ or %).
2. **Remove wig detail edit mode in POS** — color, length, size, etc. are set in Inventory. POS is read-only on wig specs.
3. **Overview payment tab bug** — likely double-counting wig payments + POS payments. Investigate `reports.py` aggregation logic.

---

### Build Sequence (Recommended Order)

| # | Task | Type | Size |
|---|------|------|------|
| 1 | Fix Overview payment tab bug | Bug fix | Small |
| 2 | Auto-update wig_status on POS sale + move to Sold Items tab | Bug fix | Small |
| 3 | POS: remove price edit, add discount field | UI cleanup | Small |
| 4 | POS: remove wig detail edit mode | UI cleanup | Small |
| 5 | Inventory → Product Management rename + Sold Items tab | Feature | Medium |
| 6 | Abandoned deposit flow (Mark as Abandoned) | Feature | Medium |
| 7 | Commission system (DB + backend + payroll integration) | Feature | Large |
| 8 | Backend role system (add 4 new roles) | Backend | Medium |
| 9 | Department-based routing + navigation restructure | Frontend | Large |
| 10 | Customer pending cart (pre-POS cart across departments) | Feature | Large |
| 11 | Repairs department page | New page | Large |
| 12 | Calendar integration | New page | Large |

**Start with tasks 1–6** (fixes + contained features). Tasks 7–12 are the architectural shift — plan those separately before building.

---

### Open Questions — ANSWERED

1. **Commission rate** — different per person, configured on their Employee page as a standing rule.
2. **Abandoned deposit** — Owner and Bookkeeper can trigger.
3. **Pending cart** — lives in the DB. Every cart item is saved (like Amazon). Data persists across page changes and browser sessions.
4. **Calendar** — build our own. Day / Week / Month views. Front desk flow: client calls → add to Customers if new → create appointment choosing customer → add services they're interested in.
5. **Repairs workflow** — Repairs acts like a salesperson: consults the client, prices the work, creates cart items. Customer drops off wig → Repairs builds the cart → customer leaves → work is done → customer invited back → arrives → goes to Front Desk → pays cart. The wig travels (possibly to multiple locations) until ready.
