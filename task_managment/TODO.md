# The Salon — Task Tracker
**Last updated:** Session 27 — 2026-06-24

Single source of truth for open/closed status. Raw meeting notes and rationale
stay in `june_1_meeting_Avi.md`, `june_8.md`, `june_17_meeting_Avi.md`,
`June_9_Issues_toFix.md` — this file tracks only what's done vs. open.
Detailed session-by-session build log lives in Claude's memory (`pages_built.md`),
not duplicated here.

---

## ✅ Migrations — All Run, None Pending

| Migration | File | Status |
|-----------|------|--------|
| 011–026 | (consolidate wig orders → role expansion → repair tasks) | ✅ All confirmed run |
| 027 | `027_wash_set.sql` — `wash_set_services` table + `pos_sale_items.sales_rep_id` | ✅ Run 2026-06-24 |

---

## 🔴 Blocked — Needs Avi / Tzipora Input

| Task | Notes |
|------|-------|
| Bank statement reconciliation / auto-import | Tzipora gets a bank statement showing only merchant names (Amazon, AliExpress), no line-item detail. Talk to her about the actual workflow and bank statement format before building anything. (This was tracked as two separate numbers in two old meeting docs — same feature.) |
| Clock-in / payroll integration | Salon has a fingerprint clock-in system. Two options: direct integration with the device, or upload a weekly Excel export. Ask Tzipora which is feasible and what the Excel format looks like. |
| Commission calculation engine | Need the real commission table from Tzipora (rate per employee, what it applies to). **Data-capture groundwork is done** (Session 27): `sales_rep_id` now persists on every `pos_sale_item`, not just on the pending cart. The actual $ → payroll calculation is not built. |
| DaySmart integration approach | Direct API integration, or manually mirror data? Still unanswered. |

---

## 🟡 Open — Ready to Build

| Task | Notes |
|------|-------|
| Persist unsaved form data on navigation | If a user starts filling a form and navigates away, restore the fields on return. |

---

## 🔵 Open — Larger / Architectural

| Task | Notes |
|------|-------|
| DaySmart PDF/API auto-import | Parse the daily PDF report (or integrate the API) to auto-fill data entry. Long-term, Phase 3. |
| Super Board redesign | Currently reads from the dead `daily_summary` table. Rebuild on top of `reports.py`. |
| Ella chatbot redesign | `get_daily_summary` tool returns empty — rebuild Ella's tools around POS/reports data. |
| Department-based routing (`/sales/*`, `/repairs/*`, `/front-desk/*`, etc.) | Originally planned to replace the single `/bookkeeper/*` layout. The role-filtered single-layout nav (built Session 21) may already cover the actual need — confirm with Avi before sinking time into this. |

---

## 🛠️ Code Audit Findings (`June_9_Issues_toFix.md`, 2026-06-09 — still all open)

None of these have been touched since the audit. The critical ones are the highest-stakes outstanding work in the codebase — worth prioritizing over new features.

**Critical**
- POS sale has no transaction atomicity (`pos_sales.py`) — a partial failure mid-save can leave a sale with no payment, or a wig marked sold with no sale record
- Dev auth bypass disables ALL authentication if Supabase env vars are missing/misconfigured in a deploy
- `_require_bookkeeper_or_owner()` copy-pasted across 3 route files instead of one canonical dependency; `reports.py`/`financials.py` only require login, not role — any authenticated user can read all company financials

**High**
- Frontend mutations fail silently (no `onError`) — e.g. POS save can fail and the user has no idea
- Employee salary fields (`weekly_rate`, `commission_rate`, `hourly_rate`) returned to any logged-in user, not owner-only
- No audit log table — no way to reconstruct a disputed or corrupted financial record

**Medium**
- `POSPage.tsx` is 2000+ lines, needs splitting into subcomponents
- Race condition on inventory quantity decrement (no row lock — concurrent sales can oversell)
- N+1 query in POS auto-fill
- Tax rates hardcoded in frontend instead of served from backend config

---

## 🧹 Code Cleanup (low priority — from a ponytail audit pass)

- `delete` `simulate_snapshot()` — identical to `compute_snapshot()`, call it directly. `backend/app/core/financials.py:81-91`
- `delete` duplicate `_require_bookkeeper_or_owner()` — same root cause as the C3 audit finding above. `inventory.py:43`, `invoice_import.py:40`, `providers.py:26`
- `delete` `gen_uuid()` — wraps `uuid.uuid4()`, never called. `backend/app/models/models.py:24-25`
- `delete` `/wig-orders/search` — duplicates `GET /wig-orders/` filter params. `wig_orders.py:87-100`
- `delete` `/wig-orders/date/{date}` and `/payroll/week/{week_start}` — duplicate the flexible list endpoints' filters
- `shrink` `_get_daily_totals()` — one caller, inline it. `financials.py:31-49`
- `shrink` `CheckinResponse` — manually constructed 3× in one file; use `from_attributes=True`. `checkins.py:22-63`
- `shrink` `_POS_BAL_RE` regex duplicated in `customers.py:15` and `pos_sales.py:38` — one constant in `core/patterns.py`
- `shrink` `fmtDate()` / `rateDisplay()` copy-pasted across pages — move to `frontend/src/lib/format.ts`
- `shrink` `DEV_BYPASS` check duplicated in `auth.tsx` / `api.ts` — single env flag (ties into the C2 audit finding)
- `yagni` Tax rates `0.08875` / `0.045` hardcoded in both backend and frontend — ties into the M4 audit finding
- `yagni` `MAX_HISTORY = 20` baked into `ella.py` — move to settings/config
- `yagni` `board_posts` route — verify `HelloBoardPage` actually uses it, or delete

---

## ✅ Done — By Feature Area

**Auth & Roles** — 5 roles (owner/bookkeeper/sales/front_desk/repairs), per-role nav visibility, Product Management page renamed in nav.

**POS** — multi-item cart, per-item tax, wig balance payments, discount, delete-reason dialog, receipt logo + deposit agreement page 2, Sales History tab with full edit-sale capability (`c78759c`).

**Inventory / Product Management** — unified wig + product stock, Sold Items tab, Deleted Sales audit tab, AI-based wig invoice import (`bed8d2a`) **and** AI-based product invoice import for any marketplace — Amazon/Alibaba/etc. via Claude native PDF/image input (`adf8b3a`, Session 27).

**Providers** — accordion rows, contact fields, wig model price-rules editor.

**Sales Management** — inventory browse, Add to Cart with service add-on, Active Carts with live editing, sales rep capture.

**Repairs — fully built** — dedicated page, ClickUp-style task board (per-wig global status + per-task status), provider assignment, video links, printable task slips, Active Carts integration (`b2a9f07`, `5a98acd`–`b6b3bac`). Google Drive integration deferred — Haya shares folder links manually via a video URL field instead.

**Wash & Set — built Session 27** — dedicated page (`/bookkeeper/wash-set`), customer → stylist → service (new `wash_set_services` lookup table) → price → cart, same `pending_cart_items` → POS pipeline as Repairs/Sales. Fixed two related bugs while building it: `sales_rep_id` was being silently dropped at POS checkout, and pending service items were always mislabeled `'repair'` in POS regardless of department (`8a8ca94`, `f7d25c8`, `5583446`).

**Customer Pending Cart** — the cross-department "Amazon model" cart (`pending_cart_items`) that POS, Sales, Repairs, and Wash & Set all feed into.

**Calendar** — Day/Week/Month views, department color-coding, appointment CRUD.

**Operation Overview** — Day/Month/Range, 5 report tabs + Sales History, all business logic (tithes, sales tax, wig revenue/tax deferral, repair revenue deferral tied to wig deposits) automated. Sales History tab also has "Mark as Abandoned" per sale — forfeits a pending wig deposit as revenue, returns the wig to inventory, clears the customer association (`45d925a`, Session 27).

**Expenses** — 13 industry-standard categories, bank/cash payment-source tag per entry (already built — toggle + badge in `ExpensesPage.tsx`, just never marked off in any doc until now).

**Payroll** — weekly accordion, clock-in/out driven hours, mark paid/undo.

**Customers CRM** — purchase history (POS sales + wig sales, deduped), edit/delete wig from history.

**Employees** — time log modal per employee.

**Ella (AI chatbot)** — 9 tools, `/remember` command.

---

## Open Questions (need Avi)

- DaySmart: direct API integration, or manually mirror data?
- Which bank's statement format does the reconciliation feature need to support first?
