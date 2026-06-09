# The Salon — Open Tasks (updated 2026-06-09)

---

## 🔴 Quick Fixes (small, self-contained)

| # | Task | Area | Notes |
|---|------|------|-------|
| F1 | **Overview payment tab bug** | Reports | Numbers adding up incorrectly — likely double-counting wig payments |
| F3 | **POS: lock product price, add discount field** | POS | Price comes from inventory — lock it. Add discount ($ or %) field instead. (Sales page is already locked — this is for POSPage specifically) |
| F4 | **POS: remove wig detail edit mode** | POS | Color/length/size/front are set in Inventory — Sales + Front Desk should not edit them |

---

## 🟡 Medium Features

| # | Task | Area | Notes |
|---|------|------|-------|
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
| L4 | **Repairs department page** | New Page | Consult → price → build cart items; wig travels until ready; customer invited back to pay |
| L5 | **DaySmart PDF parser** | Integrations | Parse daily PDF → auto-fill Tzipora's data entry |

---

## ✅ Done (Session 17 — 2026-06-09)

| Task | Commit |
|------|--------|
| F2: Auto-update wig_status → `sold` on POS checkout; reset to `in_stock` on sale delete | `bc5c4a3` |
| Sold wigs hidden from Inventory Wigs tab (client-side filter) | `0869dd2` |
| Sold Items tab added to Inventory page (SoldWigTable + history drawer on row click) | `bc5c4a3` |
| Sales Management: read-only price field (set in Inventory, not editable in panel) | `bc5c4a3` |
| Sales Management: card/list view toggle on Inventory tab | `bc5c4a3` |
| Sales Management: panel width widened to `clamp(460px, 34vw, 600px)` | `bc5c4a3` |
| Sales Management: Sales Rep field moved directly under Customer | `bc5c4a3` |
| Sales Management: service/repair add-on inside Add to Cart panel (wigs only) | `bc5c4a3` |
| Service price input: editable field, auto-fills from `default_price`, string state + placeholder | `70b7499` → `f3e3699` |
| Discount shown on receipt above tax row | `bc5c4a3` |
| Sales tax calculated on discounted price (discountRatio approach) | `bcabc15` |
| Removed Tithes (מעשרות) from Overview Summary tab | `bcabc15` |
| Delete sale: reason dialog required before deletion; reason logged as note event on wig history | `bc5c4a3` |
| Active Carts: clicking cart card header opens CartEditPanel (add/remove items + service add-on) | `a7170dd` |
| CartEditPanel: self-subscribes to `['cart-active']` — live updates without prop-threading | `f3e3699` |
| CartEditPanel: flat list layout (borderTop + row borderBottom, no card wrapper) | `f3e3699` |
| Migration 019 run in Supabase: `discount_amount` on pos_sales, `sales_rep_id` on pending_cart_items | — |

---

## ✅ Done (Session 16 — 2026-06-08)

| Task | Commit |
|------|--------|
| Calendar page (Day/Week/Month views) + appointments backend (migration 017) | `3a08e83` |
| June 8 meeting notes + full architectural build plan (`june_8.md`) | `3a08e83` |

---

## Architecture / Redesign

| Task | Area | Notes |
|------|------|-------|
| **Inventory → Product Management rename** | Inventory Page | Rename page; Sold Items tab already built. Just rename the page title and nav item |
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
| ~~019~~ | ~~`backend/migrations/019_discount_and_salesrep.sql`~~ | ✅ Run (2026-06-09) |

---

## Open Questions (need Avi)

- Which bank format does the statement parser need to support?
- Full DaySmart service list (Ofir to pull and share)
- DaySmart API: direct integration or manual mirror?
