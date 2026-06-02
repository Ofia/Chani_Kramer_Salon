## June 1 Avi Meeting — Feature Backlog

| # | Task | Area | Status | Commit |
|---|------|-------|--------|--------|
| 1 | Appointments calendar (DaySmart API or in-house) | New | ⬜ | — |
| 2 | Inventory management tools (add, edit, view stock) | New | ✅ Done | 775eca3 |
| 3 | Inventory from PDF — supplier delivery slip | Inventory | ⬜ | — |
| 4 | Auto markup calculator (cost → retail price per brand) | Inventory | ✅ Done | 775eca3 |
| 5 | Repair service notes field | POS | ⬜ | — |
| 6 | Full DaySmart service list in POS dropdown | POS | ⬜ | — |
| 7 | Delete sale — role-gated (Tzipora + Owners only) | POS | ⬜ | — |
| 8 | Edit sale/receipt for Tzipora | Bookkeeper | ⬜ | — |
| 9 | Remove QuickPay from payment options | POS | ✅ Done | 65a0973 |
| 10 | POS: sales tax toggle (NY vs non-resident) | POS | ⬜ | — |
| 11 | POS: shipping option + address for wig deliveries | POS | ⬜ | — |
| 12 | Expense categories (food, shipping, transport…) | Expenses | ⬜ | — |
| 13 | Bank/Cash source tag on each expense | Expenses | ⬜ | — |
| 14 | Bank statement auto-import for expenses | Expenses | ⬜ | — |
| 15 | Persist unsaved form data on navigation | UX | ⬜ | — |
| 16 | Employee page: time log modal (view + add + edit + delete) | Employees | ✅ Done | 65a0973 |

**Recommended next:** #12 + #13 (Expense categories + Bank/Cash tag), then POS → Inventory connection, then #10.

---

## Deployment — Live on Railway + Vercel ✓

**Status:** Fully deployed and working as of 2026-05-20.
- Backend: Railway (FastAPI + uvicorn, `$PORT` env var)
- Frontend: Vercel (React/Vite, SPA rewrites via `vercel.json`)
- DB + Auth: Supabase (unchanged)

**Known production quirk:** Railway cold-starts sometimes return an HTML page with HTTP 200 for the first few requests. All list queries are guarded with `Array.isArray(r.data) ? r.data : []` and single-record queries with `typeof r.data === 'object'` checks. Auth profile fetch has a persistent retry every 3s until it succeeds.

**Open:** Super Board (owner dashboard) tab still not rendering in production sidebar — profile fetch from `/users/me` may be failing silently. Persistent retry added; needs live verification.

---

## Phase 2 — Roles & In-Salon Workflow

[ ] Create `sales` role — sales floor staff can view wig inventory and log a sale (prints receipt with DaySmart serial, fills in wig details). This eliminates the manual paper receipt step.

[ ] Create `front_desk` role — front desk can review daily sales entries and generate/confirm the daily report. This replaces the Microsoft Access → envelope → Tzipora pipeline.

[ ] When both roles exist, wire up a digital document handoff: sales entry → front desk review → auto-queued in Tzipora's daily entry flow.

---

## Business Logic — Distributor Payment Tracking

[ ] The owner pays the wig distributor ONLY after a wig is fully paid by the client. Currently the app tracks this via `wig_orders.status = paid_in_full` and the Wig Orders "Completed" tab — but there is no explicit AP (accounts payable) flag or notification.

[ ] Future: when a wig flips to `paid_in_full`, trigger a "distributor payment due" event so Avi can see which distributors need to be paid and for which wigs.

---

## DaySmart PDF Automation

[ ] Parse DaySmart daily PDF → auto-fill Tzipora's Activity tab (wig serial, client, transaction details). This is the single highest-leverage automation in the entire system.
