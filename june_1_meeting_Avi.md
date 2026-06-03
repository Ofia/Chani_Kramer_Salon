# June 1, 2026 — Avi Meeting Notes

## Higher-Level Architecture Decisions

### 1. Inventory-First Rule
No wig can be sold unless it is already logged in the inventory system.
Every sale must reference an existing inventory record.

### 2. Wig Lifecycle is Core
Wigs move through many states — this is the backbone of the business:
- Delivered by supplier (not yet paid for — consignment model)
- Available for sale in salon
- Sold to customer (revenue recognized on full payment)
- Damaged → returned to supplier for repair
- Transferred to another salon (supplier picks up)
- Customer-owned wigs receive ongoing services (cuts, colors, repairs) — full service history tracked per serial number

**The full history log of every wig is a core feature, not a nice-to-have.**

### 3. Services Link to Wigs via Serial Number
Wash & Set and Repair appointments are often tied to a specific wig.
- If wig is customer-owned, we look up the customer → find their serial number(s)
- Service records attach to the wig's history log

### 4. POS Service & Product Model — Overhaul
Replace the 4 hardcoded service options with:
- **Services dropdown**: full list from DaySmart (see images — includes "2 Wash and Sets", "3 Wash and Sets", "Buy Wig Consultation", "Buy Fall Consultation", repairs, etc.)
- **Products dropdown**: pulled from inventory (wigs, products)
This decouples the POS from hardcoded categories permanently.

### 5. Payroll — Separate Page, Clock-In System
- Remove payroll from daily entry flow entirely
- Add employee **clock-in / clock-out** log → auto-calculates hours
- Payroll week: **Wednesday to Thursday**
- Payment day: **Thursday**
- Full add/edit/delete on the Payroll page only

### 6. Expenses — Categories + Bank Statement Parser
- Expenses must have categories: Food, Shipping, Transportation, Supplies, Rent, Social Media, Maintenance, Misc, etc.
- Add a **bank statement parser** feature: upload bank statement → auto-create expense entries
- Each expense tagged with payment source: **Bank** or **Cash**

### 7. Super Board — PnL per Department Widget
- Build backend calculator for P&L broken down by department (W&S, Wig Sales, Repairs, etc.)
- Surface as a widget on the Super Board dashboard
- Avi defines the department breakdown logic

## 8. remove the 40% rule from the daily entry
- the 40% was just Avi's way to proximate the expenses he has
- now, when we have a cosolidated system he will have an accurate overview on expensess
- we remove that 40% calculator from the daily entry and work towards well structure reporting system

---

## Specific Feature Tasks

| # | Task | Area | Priority | Status |
|---|------|------|----------|--------|
| 1 | Appointments calendar (DaySmart integration or build in-house) | New Feature | High | ⬜ |
| 2 | Inventory management tools (add, edit, view stock) | New Feature | High | ✅ 775eca3 |
| 3 | Inventory from PDF — supplier delivery slip auto-import | New Feature | Medium | ⬜ |
| 4 | Auto markup calculator for wigs (cost → retail price) | Inventory | Medium | ✅ 775eca3 |
| 5 | Repair service notes field (describe repair details) | POS / Services | High | ⬜ |
| 6 | Sub-categories for W&S and Repairs (full DaySmart service list) | POS | High | ⬜ |
| 7 | Delete sale — role-gated (Tzipora + Owners only, not frontdesk/sales) | POS / Permissions | High | ⬜ |
| 8 | Edit sale / receipt for Tzipora (standalone, not inside daily entry) | Bookkeeper | High | ⬜ |
| 9 | Remove QuickPay from payment options | POS | Quick Win | ✅ 65a0973 |
| 10 | POS: sales tax toggle (NY resident = 8.875% / non-resident = 0%) | POS | High | ⬜ |
| 11 | POS: shipping option + shipping address field for wig deliveries | POS | Medium | ⬜ |
| 12 | Expense categories (food, shipping, transport, etc.) | Expenses | High | ⬜ |
| 13 | Bank / Cash source tag on each expense | Expenses | High | ⬜ |
| 14 | Bank statement auto-import for expenses | Expenses | Medium | ⬜ |
| 15 | Persist unsaved form data on navigation — if user starts filling a form and leaves the page, fields are restored when they return (no data lost mid-entry) | UX / All Forms | High | ⬜ |
| 16 | Employee page: each row has a small button that opens a centered modal with the employee's full time log (clock-in/out history), editable — add, edit, delete individual entries | Employees / Time Logs | High | ✅ 65a0973 |

---

## DaySmart Context
The salon runs DaySmart as their POS/appointment system. Screenshots show:
- Appointment book with per-stylist day view (Chani K, Chavi, Ariella, Perela, Chaya Suri)
- Service list includes: "2/3 Wash and Sets", "Buy Wig Consultation", "Buy Fall Consultation", repair types, and more
- This app is the **financial intelligence layer** on top of DaySmart — not a replacement
- Goal: read from DaySmart data, not duplicate scheduling

---

## Open Questions
- [ ] Does Avi want to integrate DaySmart API directly, or mirror data manually?
- [ ] What is the full markup formula for wigs? (cost × X% ?)
- [ ] Which bank does the statement parser need to support? (format varies per bank)
- [ ] Full DaySmart service list still needed — Ofir to pull and share
- [ ] Department definitions for PnL: exactly which categories count as "departments"?

---

## Build Log

### 2026-06-01
- ✅ Clock-in/out system (migration 007), payroll accordion + cash/bank split (migration 008), employee time log modal
- ✅ Inventory overhaul (migration 009) — wig + product inventory, brand markups, inventory events
- ✅ Remove QuickPay from POS (task #9)

### 2026-06-03 — Session 1 (06:56–08:00)
- ✅ Providers page — full stack (migration 010: providers + repair_services, 8 provider seeds, 28 repair service seeds), ProvidersPage.tsx with filter tabs + add/edit modal
- ✅ Unified Add to Inventory modal — single modal with Wig/Other Product tabs, cost/markup/retail auto-calc, Provider dropdown
- ✅ Hello Board 50/50 split
- Commits: 63e33bd, 619caed

### 2026-06-03 — Session 2 (12:47–14:00)
- ✅ Migration 011: consolidated wig_orders into inventory_items (one source of truth)
  - 12 sale columns added to inventory_items (customer, total_price, sale_status, order_date, additional_charges, provider_id, markup_pct, etc.)
  - wig_payments FK moved from wig_order_id → inventory_item_id
  - wig_orders table dropped
  - Backend: models.py, schemas.py, wig_orders.py (rewritten), pos_sales.py, customers.py updated
  - Frontend: all WigOrder consumers updated (status→sale_status, direct_wig_orders→wig_sales)
  - TypeScript clean, 0 errors
  - Commit: 5a5a7e7
  - ⚠️ Run migration 011 SQL in Supabase SQL Editor

## ⚠️ POS Page — Must Test + Overhaul Next
- DB/backend foundation complete (Migration 011 + inventory-first architecture)
- **POS page UI still shows old hardcoded buttons** (New Wig, W&S, Repair, From Inventory)
- Need to: (1) run Migration 011, (2) test existing POS still works, (3) build new POS UI
- New POS UI needs: services dropdown (28 repair types + W&S), wig picker from inventory, product picker, sales tax 3-mode toggle (4.5% services / 8.875% goods / 0% exempt), shipping option, role-gated delete
- Tasks remaining: #5, #6, #7, #8, #10, #11, #12, #13, #14, #15
