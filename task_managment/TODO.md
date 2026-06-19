# The Salon — Open Tasks
**Last updated:** Session 24 — 2026-06-19

---

## ⚠️ Pending Migrations — Run in Supabase SQL Editor

| Migration | File | Status |
|-----------|------|--------|
| ~~011~~ | `011_consolidate_wig_orders.sql` | ✅ Run |
| ~~012~~ | `012_pos_enhancements.sql` | ✅ Run |
| ~~013~~ | `013_expense_categories.sql` | ✅ Run |
| ~~015~~ | `015_pos_item_tax.sql` | ✅ Run |
| ~~016~~ | `016_inventory_event_pos_sale.sql` | ✅ Run |
| ~~017~~ | `017_appointments.sql` | ✅ Run |
| ~~018~~ | `018_pending_cart.sql` | ✅ Run |
| ~~019~~ | `019_discount_and_salesrep.sql` | ✅ Run (2026-06-09) |
| ~~020~~ | `020_seed_sary_provider.sql` | ✅ Run (2026-06-11) |
| ~~021~~ | `021_provider_contact_and_wig_models.sql` | ✅ Run (2026-06-11) |
| ~~022~~ | `022_seed_provider_wig_models.sql` | ✅ Run (2026-06-11) |
| ~~023~~ | `023_repair_orders.sql` | ✅ Run (2026-06-11) |
| ~~024~~ | `024_role_expansion.sql` | ✅ Run (2026-06-16) |
| ~~025~~ | `025_deleted_sales.sql` | ✅ Run (2026-06-16) |

---

## 🔴 Open — Quick Fixes

| # | Task | Area | Notes |
|---|------|------|-------|
| F1-b | **Overview payment tab UI** | Reports | Backend fixed (session 18). Verify numbers in UI match real data |

---

## 🟡 Open — Medium Features

| # | Task | Area | Notes |
|---|------|------|-------|
| M2 | **Abandoned deposit flow** | Wig Orders | "Mark as Abandoned" → return wig to inventory + deposit → misc revenue. Owner + Bookkeeper only |
| M3 | **Backend role system** | Backend | Add `sales`, `repairs`, `front_desk` roles to `UserRole` enum + update route guards |
| ~~8~~ | ~~**Edit sale / receipt**~~ | ~~POS~~ | ✅ Done — Sales History tab (Session 24). Edit items, prices, tax, add/remove rows, delete. Commit `c78759c` |
| 8b | **Invoice upload to Product Mgmt** | Product Mgmt | Port wig invoice importer (session 19) to product/supply invoices on Product Management page |
| 14 | **Bank statement auto-import** | Expenses | Upload bank statement → auto-create expense entries (needs Tzipora input first) |
| 15 | **Persist unsaved form data** | UX | If user navigates away mid-form, restore on return |

---

## 🔵 Open — Large / Architectural

| # | Task | Area | Notes |
|---|------|------|-------|
| L1 | **Commission system** | Payroll / Wig Lifecycle | Per-employee %, lifecycle events (sold/cancelled/returned), feeds into payroll. New table: `commission_entries` |
| L2 | **Department-based routing + nav** | Frontend | Replace `/bookkeeper/*` with dept layouts: `/sales/*`, `/repairs/*`, `/front-desk/*`, `/bookkeeping/*` |
| ~~L4~~ | ~~**Repairs department page**~~ | ~~New Page~~ | ✅ Built — Session 20 |
| L5 | **DaySmart PDF parser** | Integrations | Parse daily PDF → auto-fill Tzipora's data entry |

---

## 🏗️ Open — Architecture / Redesign

| Task | Area | Notes |
|------|------|-------|
| **Inventory → Product Management rename** | Inventory Page | Rename page title + nav item. Sold Items tab already built. |
| **Super Board redesign** | Owner Dashboard | Currently reads from DailySummary (dead). Rebuild on `reports.py` |
| **Ella redesign** | AI Chatbot | `get_daily_summary` tool returns empty. Rebuild tools around POS/reports data |

---

## ✅ Done — Session 24 (2026-06-19)

| Task | Commit | Notes |
|------|--------|-------|
| Task #3: Phone search audit — POS `cell→phone` fix | session commits | `createCustomerMutation` was sending `cell: newPhone` instead of `phone: newPhone`. All other search fields were already correct. |
| Task #3: Repairs pill phone fallback | session commits | `renderItem` now shows `c.phone \|\| c.cell`; `sub` uses same fallback. Covers Avi's cell-only number. |
| Task #6: External wig → Sold Items $0 + history note | session commits | `is_external=True` on inventory POST: sets price=$0, wig_status=sold, creates "Added from external on {date}" note event |
| Task #6: Receipt shows wig serial for repair items | session commits | POSPage receipt: "Wig: {serial}" sub-line under repair item description |
| Task #6: Cart `wig_serial` from repair relationship | session commits | `_build_response` in cart.py: derives wig_serial from `repair_order.inventory_item.daysmart_serial` |
| Task #6: Dynamic dept banner ("from Repairs") | `1b9d417` | Banner dynamically reads `p.department` → "waiting from Repairs" not hardcoded "from Sales" |
| Task #2: `GET /pos-sales/?start=&end=` range endpoint | `c78759c` | Returns all sales in date range, newest first |
| Task #2: `PUT /pos-sales/{id}/items` edit endpoint | `c78759c` | Bulk edit: edit/add/remove line items, recalculate totals, audit log. Bookkeeper/owner only. Wig items: price-edit only. |
| Task #2: `PosSaleItemEdit` + `PosSaleBulkEdit` schemas | `c78759c` | Added to `schemas.py` after `PosSaleResponse` |
| Task #2: Sales History 6th tab in OperationOverviewPage | `c78759c` | Expandable rows, inline item editing, add item, delete with reason, print receipt, print daily list |

---

## ✅ Done — Session 23 (2026-06-17)

| Task | Commit | Notes |
|------|--------|-------|
| Task #1: Global scroll-on-number-field bug | session commits | `main.tsx` passive wheel listener blurs focused `<input type="number">` |
| Task #5: Customer history total double-counting | `42de759` | Removed `+ wig_balance_total + pos_balance_total` from paid formula |
| wig balance_due missing sale_tax_amount | session commits | `InventoryItem.balance_due` now adds `sale_tax_amount` |
| paid_in_full threshold not including tax | session commits | 5 places in pos_sales.py + 2 in wig_orders.py updated |
| `pos_balance` cart item type (open POS sale balances) | session commits | Full OpenPosSaleBalancePanel + `GET /pos-sales/open-balances/customer/{id}` endpoint |
| `Documentation/june_17_meeting_Avi.md` | session commits | 10-point meeting notes with priority table |

---

## ✅ Done — Session 22 (2026-06-16)

| Task | Commit | Notes |
|------|--------|-------|
| Repairs wig picker → "Customer's Wigs" | session commits | Filters by customer_id; walk-in auto-switches to External Wig mode |
| External Wig → auto-creates linked InventoryItem | session commits | `customer_id` + `sale_status: paid_in_full` on inventory create |
| Customer history: edit wig (pencil icon) | `e106381`+ | WigEditModal: serial/brand/color/length/size/order_date/notes |
| Customer history: delete wig (trash icon) | session commits | `window.confirm` + `DELETE /inventory/{id}` |
| Migration 025: deleted_sales audit table | session commits | JSONB snapshot of every POS sale before hard-delete — RUN |
| Product Management: Deleted Sales tab | session commits | Expandable rows, reason chip, line items + payments detail |

---

## ✅ Done — Session 21 (2026-06-16)

| Task | Commit | Notes |
|------|--------|-------|
| Migration 024: role expansion | `7e1883d` | `sales`, `front_desk`, `repairs` added to `user_role` enum |
| BookkeeperLayout: per-role nav visibility | `7e1883d` | 14 nav items with `roles[]` arrays |
| Inventory → "Product Management" rename | `7e1883d` | Nav label + page header only; route unchanged |
| Repair revenue/tax deferral | `16fa0f3`, `38bcd61` | Repairs on pending-wig ticket deferred to pickup_date |

---

## ✅ Done — Session 20 (2026-06-11)

| Task | Notes |
|------|-------|
| L4: Repairs Management Page | `RepairsPage.tsx` — two tabs: Repair Orders + Active Carts. Create order (customer + wig + services), status management, edit panel. Migration 023 needs to be run. |
| Migration 023 | `023_repair_orders.sql` — repair_orders table, repair_order_status enum, repair_order_id FK on pending_cart_items |
| Backend: RepairOrder model + schemas + route | `models.py`, `schemas.py`, `repair_orders.py`, `main.py` |
| cart.py: repair_order_id passthrough | CartItemCreate now passes repair_order_id to PendingCartItem |

---

## ✅ Done — Session 19 (2026-06-11)

| Task | Commit |
|------|--------|
| Unify all sources of truth: memory, TODO, CLAUDE.md aligned to session 18 | `851a8ad` |
| P1: Invoice PDF import — upload invoice → parse → markup lookup → preview → bulk add to inventory | `bed8d2a` |
| Invoice parser: append size code to serial (RINA55361 → RINA55361-11M) | `ead3a5c` |
| Receipt fix: wig table above repair/service table | `971194f` |

---

## ✅ Done — Session 18 (2026-06-11)

| Task | Commit |
|------|--------|
| F1: Fix Overview payment tab double-counting (wig_balance + mixed sales) | `9569c84` |
| Providers page: accordion rows, expand to show contact info + wig models editor | `2f94fe0` |
| Provider fields: email, phone, address, wig_models (JSONB) — migration 021 | `2f94fe0` |
| Migration 020: seed Sary as wig company provider | `2f94fe0` |
| Markup field: changed from % to flat USD | `e3f62d1` |
| WigModel schema: added `lengths: [{length, cost}]`; retail = cost + markup computed live | `66ec904` |
| WigModelsEditor: nested accordion (model → lengths), cost + live retail display, all editable | `66ec904` |
| Migration 022: seed all 4 providers with full wig model / length / cost data | `a273db6` |
| Documentation: `Documentation/wigs.md` — all 4 providers, models, costs, markups, retail | — |

---

## ✅ Done — Session 17 (2026-06-09)

| Task | Commit |
|------|--------|
| F2: wig_status auto-updates to `sold` on POS checkout; resets to `in_stock` on delete | `bc5c4a3` |
| F3: POS — price field locked on inventory products; discount field added | `bc5c4a3` |
| F4: POS — wig detail edit mode removed | `bc5c4a3` |
| M1 (task 5 from June 8): Inventory Sold Items tab (SoldWigTable + history drawer) | `bc5c4a3` |
| Sales Management: read-only price, wider panel, Sales Rep field, card/list toggle | `bc5c4a3` |
| Service add-on in Add to Cart panel (wigs only): dropdown + price + tax | `bc5c4a3` |
| CartEditPanel: self-subscribing, flat list, add/remove items + service add-on | `a7170dd` → `f3e3699` |
| Delete sale: reason dialog + deletion logged as note event on wig history | `bc5c4a3` |
| Sales tax on discounted subtotal (discountRatio) + discount on receipt | `bcabc15` |
| Removed Tithes from Overview Summary tab | `bcabc15` |
| Migration 019: discount_amount + sales_rep_id | — |

---

## ✅ Done — Session 16 (2026-06-08)

| Task | Commit |
|------|--------|
| Calendar page (Day/Week/Month, dept colors, create/update/delete) | `3a08e83` |
| Appointments backend (migration 017, model, schemas, CRUD routes) | `3a08e83` |

---

## Open Questions (need Avi)

- Which bank format does the statement parser need to support?
- DaySmart API: direct integration or manual mirror?
- Migrations 011 / 012 / 013 / 015 / 017 — were these run in Supabase? Verify.
