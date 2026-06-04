## June 1 Avi Meeting — Feature Backlog

| # | Task | Area | Status | Commit |
|---|------|-------|--------|--------|
| 1 | Appointments calendar (DaySmart API or in-house) | New | ⬜ Phase 3 | — |
| 2 | Inventory management tools (add, edit, view stock) | New | ✅ Done | 775eca3 |
| 3 | Inventory from PDF — supplier delivery slip | Inventory | ⬜ Phase 3 | — |
| 4 | Auto markup calculator (cost → retail price per brand) | Inventory | ✅ Done | 775eca3 |
| 5 | Repair service notes field | POS | ✅ Done | ce36201 |
| 6 | Full DaySmart service list in POS dropdown | POS | ✅ Done | ce36201 |
| 7 | Delete sale — role-gated (Tzipora + Owners only) | POS | ✅ Done | 6dad443 |
| 8 | Edit sale/receipt for Tzipora | Bookkeeper | ⬜ | — |
| 9 | Remove QuickPay from payment options | POS | ✅ Done | 65a0973 |
| 10 | POS: sales tax toggle (NY vs non-resident) | POS | ✅ Done | 6dad443 |
| 11 | POS: shipping option + address for wig deliveries | POS | ✅ Done | 6dad443 |
| 12 | Expense categories (industry-standard 13 categories) | Expenses | ✅ Done | c98ad3e |
| 13 | Bank/Cash source tag on each expense | Expenses | ⬜ | — |
| 14 | Bank statement auto-import for expenses | Expenses | ⬜ | — |
| 15 | Persist unsaved form data on navigation | UX | ⬜ | — |
| 16 | Employee page: time log modal (view + add + edit + delete) | Employees | ✅ Done | 65a0973 |

**Recommended next:** #13 (Bank/Cash source tag per expense), then #8 (Edit Sale), then #14 (bank statement parser).

---

## ⚠️ Pending Migrations — Run in Supabase SQL Editor

| Migration | File | What it does | Status |
|-----------|------|-------------|--------|
| 011 | `backend/migrations/011_consolidate_wig_orders.sql` | Merges wig_orders into inventory_items | ⚠️ Run ASAP |
| 012 | `backend/migrations/012_pos_enhancements.sql` | Adds notes, tax_rate, tax_amount, shipping columns | ⚠️ Run ASAP |
| 013 | `backend/migrations/013_expense_categories.sql` | Replaces 14 old categories with 13 industry-standard | ⚠️ Run ASAP |

---

## Architecture Changes (June 4, 2026)

### Daily Entry → Operation Overview
- **Daily Entry page (DailyEntryPage.tsx) is retired** — no longer accessible
- `/bookkeeper/daily` now redirects to `/bookkeeper/overview`
- New **OperationOverviewPage** (`/bookkeeper/overview`) is the single reporting hub:
  - **Read-only aggregation** — data flows in from POS, Expenses, and Payroll pages automatically
  - **Period selector:** Day / Month / Date Range
  - **5 tabs:** Revenue | Payments | Expenses | Payroll | Summary
  - **Charts:** Donut (revenue, payments, expenses) + Horizontal bar (payroll by employee)
  - **Payments tab:** includes tax collected box (what to set aside for NY State)
  - **Summary tab:** net profit, tithes, wig deposits held

### 40% Bank Rule — Permanently Removed
- Removed from all UI, backend logic, and CLAUDE.md
- Reason: now that all expenses are tracked accurately in the system, Avi deposits the actual amount needed — no percentage estimate needed
- Do NOT reintroduce this anywhere

### Expense Categories (13 Industry-Standard)
Replaced 14 business-specific labels (itzik, grossman, monsey_driver…) with:
`rent_facilities` · `utilities` · `supplies_materials` · `cost_of_goods` · `marketing_advertising` · `transportation_shipping` · `maintenance_repairs` · `food_beverages` · `professional_services` · `taxes_fees` · `charitable_giving` · `reconciliation` · `other`
- Charitable Giving = מעשרות (religious tithes treated as expense)

---

## Deployment — Live on Railway + Vercel ✓

**Status:** Fully deployed and working.
- Backend: Railway (FastAPI + uvicorn, `$PORT` env var)
- Frontend: Vercel (React/Vite, SPA rewrites via `vercel.json`)
- DB + Auth: Supabase (unchanged)

**Known production quirk:** Railway cold-starts sometimes return HTML with HTTP 200 on first request. All list queries guarded with `Array.isArray()` + `.catch(() => [])`.

---

## Phase 2 — Roles & In-Salon Workflow

[ ] Create `sales` role — sales floor staff can view wig inventory and log a sale (prints receipt with DaySmart serial, fills in wig details). Eliminates manual paper receipt.

[ ] Create `front_desk` role — front desk can review daily sales entries and generate/confirm the daily report. Replaces Microsoft Access → envelope → Tzipora pipeline.

[ ] Digital document handoff: sales entry → front desk review → auto-queued in Tzipora's flow.

---

## Business Logic — Distributor Payment Tracking

[ ] The owner pays the wig distributor ONLY after a wig is fully paid by the client. Currently tracked via `wig_orders.status = paid_in_full` and the Wig Orders "Completed" tab — but there is no explicit AP flag or notification.

[ ] Future: when a wig flips to `paid_in_full`, trigger a "distributor payment due" event so Avi can see which distributors need to be paid and for which wigs.

---

## DaySmart PDF Automation

[ ] Parse DaySmart daily PDF → auto-fill Tzipora's data entry (wig serial, client, transaction details). Highest-leverage automation in the system.
