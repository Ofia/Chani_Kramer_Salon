# The Salon — Open Tasks (updated 2026-06-08)

---

## 🔴 Quick Fixes (small, self-contained)

| # | Task | Area | Notes |
|---|------|------|-------|
| F1 | **Overview payment tab bug** | Reports | Numbers adding up incorrectly — likely double-counting wig payments |
| F2 | **Auto-update wig_status on POS sale** | POS / Inventory | Status doesn't flip to `sold` automatically; must also move wig to Sold Items tab |
| F3 | **POS: lock product price, add discount field** | POS | Price comes from inventory — lock it. Add discount ($ or %) field instead |
| F4 | **POS: remove wig detail edit mode** | POS | Color/length/size/front are set in Inventory — Sales + Front Desk should not edit them |

---

## 🟡 Medium Features

| # | Task | Area | Notes |
|---|------|------|-------|
| M1 | **Inventory → Product Management** | Inventory Page | Rename page; Tab 1 = Inventory (in_stock), Tab 2 = Sold Items (wig_status=sold) |
| M2 | **Abandoned deposit flow** | Wig Orders / Sales | "Mark as Abandoned" → return wig to inventory + convert deposit to misc revenue. Owner + Bookkeeper only |
| M3 | **Backend role system** | Backend | Add `sales`, `repairs`, `front_desk` roles to `UserRole` enum + update route guards |
| 8  | **Edit sale / receipt** | POS | Tzipora needs to fix mistakes without deleting and re-entering |
| 14 | **Bank statement auto-import** | Expenses | Upload bank statement → auto-create expense entries |
| 15 | **Persist unsaved form data** | UX | If user starts a form and navigates away, restore it on return |

---

## 🔵 Large / Architectural

| # | Task | Area | Notes |
|---|------|------|-------|
| L1 | **Commission system** | Payroll / Wig Lifecycle | Per-employee %, lifecycle events, feeds into payroll. New table: `commission_entries` |
| L2 | **Department-based routing + nav** | Frontend | Replace `/bookkeeper/*` with dept layouts: `/sales/*`, `/repairs/*`, `/front-desk/*`, `/bookkeeping/*` |
| L3 | **Customer pending cart (DB)** | POS / All Depts | Depts add items to customer's cart before checkout. Lives in DB (persists like Amazon). New table: `pending_cart_items` |
| L4 | **Repairs department page** | New Page | Consult → price → build cart items; wig travels until ready; customer invited back to pay |
| L5 | **DaySmart PDF parser** | Integrations | Parse daily PDF → auto-fill Tzipora's data entry |

---

## ✅ Done (Session 16 — 2026-06-08)

| Task | Commit |
|------|--------|
| Calendar page (Day/Week/Month views, dept colors, create/update/delete) | `3a08e83` |
| Appointments backend (migration 017, model, schemas, CRUD route) | `3a08e83` |
| june_8.md meeting notes + full build plan | `3a08e83` |

---

## Architecture / Redesign

| Task | Area | Notes |
|------|------|-------|
| **Super Board redesign** | Owner Dashboard | Currently reads from DailySummary (dead). Rebuild on `reports.py` — same source as Overview |
| **Ella redesign** | AI Chatbot | `get_daily_summary` tool returns empty. All tools need to be rebuilt around POS/reports data |

---

## ⚠️ Pending Migrations — Run in Supabase SQL Editor

| Migration | File | What it does |
|-----------|------|-------------|
| 011 | `backend/migrations/011_consolidate_wig_orders.sql` | Merges wig_orders into inventory_items |
| 012 | `backend/migrations/012_pos_enhancements.sql` | Adds notes, tax_rate, tax_amount, shipping columns |
| 013 | `backend/migrations/013_expense_categories.sql` | Replaces old categories with 13 industry-standard |
| 015 | `backend/migrations/015_pos_item_tax.sql` | Adds `sale_tax_amount` to inventory_items + `tax_amount` to pos_sale_items |
| ~~016~~ | ~~`backend/migrations/016_inventory_event_pos_sale.sql`~~ | ✅ Run |
| 017 | `backend/migrations/017_appointments.sql` | New appointments table + department/status enums |

---

## Open Questions (need Avi)

- Which bank format does the statement parser need to support?
- Full DaySmart service list (Ofir to pull and share)
- DaySmart API: direct integration or manual mirror?
