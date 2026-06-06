# The Salon — Beauty Salon Management System


## GitHub Repo:
https://github.com/Ofia/Chani_Kramer_Salon.git


## Deployment
- **Database + Auth:** Supabase (PostgreSQL + Supabase Auth)
- **Backend:** Runs locally via `uvicorn app.main:app --reload` (no cloud deploy yet)
- **Frontend:** Runs locally via `npm run dev` (deployed on Vercel)
- **Migrations:** Run SQL files manually in Supabase SQL Editor

### ⚠️ Pending Migrations (must run in Supabase SQL Editor)
| Migration | File | Status |
|-----------|------|--------|
| 011 | `backend/migrations/011_consolidate_wig_orders.sql` | ⚠️ Run ASAP |
| 012 | `backend/migrations/012_pos_enhancements.sql` | ⚠️ Run ASAP |
| 013 | `backend/migrations/013_expense_categories.sql` | ⚠️ Run ASAP |
| 015 | `backend/migrations/015_pos_item_tax.sql` | ⚠️ Run ASAP |
| ~~016~~ | ~~`backend/migrations/016_inventory_event_pos_sale.sql`~~ | ✅ Run |


## Color Palette

### Costal Glam — Charts & Data Visualization
| Swatch | Hex | Role |
|--------|-----|------|
| Pink   | `#DF5198` | Primary (Wash & Set, Cash, Line/Bar charts) |
| Blue   | `#97BBE9` | Secondary (Wig Sales, Checks) |
| Sand   | `#E3CD94` | Tertiary (Repairs, Credit Card) |
| Blush  | `#EDCADB` | Accent (Cash tax line) |
| Navy   | `#5581B1` | Accent (Chani Cuts, Zelle, CC tax line) |

### Base UI (Sidebar, Text, Buttons)
- `#212121` — Charcoal: avatars, primary action buttons
- `rgba(214,210,203,0.5)` — Warm greige: active nav highlight
- `#fafaf9` — Off-white: sidebar background
- `#f7f7f5` — Warm white: page/left-panel background

---

## Running the App

**Backend** (from `backend/` directory):
```bash
uvicorn app.main:app --reload
```

**Frontend** (from `frontend/` directory):
```bash
npm run dev
```


## Tech Stack
- **Frontend:** React + TypeScript + Vite, TanStack Query, React Router, Lucide icons, Recharts
- **Backend:** FastAPI (Python), SQLAlchemy ORM, Pydantic schemas
- **Database:** PostgreSQL on Supabase
- **Auth:** Supabase Auth (JWT passed as Bearer token to FastAPI)
- **AI:** Claude API (claude-sonnet-4-6) — Ella chatbot with tool use loop


## Project Overview
A high-end, modern web application for a successful wig salon in Brooklyn, NY.
Replacing a painful Google Sheets workflow with an intelligent, interactive system.

**Core philosophy:** Data entry happens on dedicated pages (POS, Expenses, Payroll). Reporting is read-only and flows from the data automatically. No manual summary forms.

---

## The Three Users

### Tzipora — Bookkeeper
- Primary daily user
- Uses POS to record sales, Expenses page for expenses, Payroll page for weekly pay
- Device: Desktop (primary)
- Daily workflow: receives DaySmart daily report (PDF), CC batch, Zelle bank report, handwritten sales slips

### Avi — Owner / COO
- Needs elaborative reports and business analysis
- Wants to understand trends, profitability by service, stylist efficiency
- Needs: interactive dashboards, drill-down views, AI-powered insights
- Device: Desktop + Mobile (Phase 2)

### Hani — Owner
- Results only: how much was made, how much was spent
- No detail, no noise — just the number and whether it's good or bad
- Device: Mobile (Phase 2 priority)

---

## Business Logic (Critical — Do Not Simplify Away)

### Revenue Streams
1. **Wash & Set (W&S)** — service revenue
2. **Wig Sales** — product revenue (**recognized only when wig is paid in full**)
3. **Repairs** — service revenue
4. **Product Sales** — inventory products

### Wig Revenue Recognition (CRITICAL)
**Deposits are NOT revenue.** A wig deposit is a cash-flow event — the wig hasn't been delivered yet.
- Revenue from wig sales is only recorded when `sale_status = paid_in_full`
- Deposits tracked for cash flow / bank reconciliation only
- This is standard accrual accounting

### Inventory-First Rule (CRITICAL)
No wig can be sold unless it is already logged in inventory.
Every POS wig sale must reference an existing `inventory_items` record.
The "New Wig" button is gone — wigs are added via Inventory page, then sold via POS.

### Wig Lifecycle
`ordered` → `ready` → `paid_in_full`
- Status auto-advances when `amount_paid >= total_price`
- **Distributor payment rule:** Owner pays distributor ONLY after client pays in full — deposits are held

### Tithes (מעשרות) — Religious Financial Practice — NON-NEGOTIABLE
- Net Profit → strip sales tax → ÷ 10 = Tithes
- Sales tax always stripped before tithes are calculated
- Shown in Summary tab of Operation Overview
- "Charitable Giving (מעשרות)" is also an expense category for direct tithe payments

### Sales Tax
- **POS — per item, by item type:**
  - Services (W&S, Repairs): **4.5%**
  - Products / Wigs: **8.875%**
  - Non-NY residents: **0%** (tax exempt toggle per item)
  - Wig balance payments: **0%** (tax was applied at original sale)
- **Deposit reconciliation — by payment method:**
  - Cash: 8.875%
  - CC / Check / Zelle: 4.5%
- Always stripped before tithe calculation

### Wig Tax Recognition (CRITICAL — accrual accounting)
- Wig item tax is computed at sale time and stored in `inventory_items.sale_tax_amount`
- Tax is NOT counted as collected on the sale date
- Tax is recognized in reports on `pickup_date` (when `sale_status = paid_in_full`)
- Non-wig item taxes on the same mixed sale are counted immediately via `pos_sale_items.tax_amount`

### 40% Bank Rule — PERMANENTLY REMOVED (as of 2026-06-04)
**Do NOT add this back anywhere.** Reason: Avi deposits the actual amount needed for expenses now that the system tracks everything accurately. The percentage estimate is no longer needed.

### Expense Categories (13 Industry-Standard)
Replaced old business-specific labels with:
`rent_facilities` · `utilities` · `supplies_materials` · `cost_of_goods` · `marketing_advertising` · `transportation_shipping` · `maintenance_repairs` · `food_beverages` · `professional_services` · `taxes_fees` · `charitable_giving` · `reconciliation` · `other`

### Payroll
- 19 stylists, pay entered **weekly** (not daily), week = Wednesday → Tuesday, paid Thursday
- Commission-based: Yocheved (%), Ariella (%)
- Owner cuts tracked separately: Chana Hinda, Chani
- Clock-in/out system drives hour calculations

### Profit Calculation Chain
```
Total Revenue (W&S + Wig Sales [paid_in_full only] + Repairs + Products)
  - Total Expenses (payroll + all expense categories)
= Net Profit
Net Profit → strip sales tax → ÷ 10 = Tithes
Net Profit - Tithes = Final Take-Home
```

---

## DaySmart Integration
The salon uses **DaySmart** as their POS/appointment system. This app is the financial intelligence layer on top.
- Do NOT suggest POS features (scheduling, appointments) — DaySmart handles that
- DaySmart assigns serial numbers to wigs (e.g. "rina44871", "HP33738", "BK12345")
- These are stored in `inventory_items.wig_serial`
- **Future goal:** Parse DaySmart daily PDF reports to auto-fill forms

---

## Database Schema

### Core Tables (Migration 001)
`users`, `employees`, `customers`, `sales_transactions`, `transaction_payments`,
`daily_summary`, `expense_entries`, `weekly_payroll`, `deposits`,
`financial_snapshots`, `ai_conversations`, `ella_facts`

### Extensions
- **002** — `wig_payments` table, `wig_status` enum
- **003** — `board_posts`, `company_notifications`, `staff_checkins`
- **004** — `customers.access_id` (Access DB import)
- **005** — `additional_charges` on inventory
- **006** — `pos_sales`, `pos_sale_items`, `pos_sale_payments`, `wig_payments.pos_sale_id`
- **007** — `employee_time_logs`
- **008** — `weekly_payroll.cash_amount`, `bank_amount`, `status`, `paid_at`
- **009** — `inventory_items` (unified wig + product stock, brand markups)
- **010** — `providers`, `repair_services` (28 types seeded)
- **011** ⚠️ — Consolidates wig_orders into `inventory_items` (inventory-first architecture)
- **012** ⚠️ — `pos_sale_items.notes`, `pos_sales.tax_rate/tax_amount/shipping_amount/shipping_address`
- **013** ⚠️ — 13 new expense category enum values (replaces old 14)
- **015** ⚠️ — `inventory_items.sale_tax_amount` (wig tax locked at sale), `pos_sale_items.tax_amount` (per-item tax)
- **016** ⚠️ — `inventory_events.pos_sale_id` FK (links events to creating sale for clean deletion)

**Supabase enum naming:** Always snake_case in SQL. In SQLAlchemy, always pass `name=` explicitly.

---

## Pages & Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/bookkeeper/hello` | HelloBoardPage | Hello board: posts, clock-in, notices, weather |
| `/bookkeeper/pos` | POSPage | Point of sale — multi-item cart, wig balance payments |
| `/bookkeeper/overview` | OperationOverviewPage | Read-only reporting hub (Day/Month/Range, 5 tabs) |
| `/bookkeeper/expenses` | ExpensesPage | Add/delete expense entries |
| `/bookkeeper/payroll` | PayrollEntryPage | Weekly payroll accordion, mark paid |
| `/bookkeeper/wigs` | WigOrdersPage | In Progress / Completed wig orders |
| `/bookkeeper/sales` | SalesManagementPage | Sales + inventory management |
| `/bookkeeper/providers` | ProvidersPage | Wig providers + repair services |
| `/bookkeeper/inventory` | InventoryPage | Inventory stock, add/edit/events |
| `/bookkeeper/employees` | EmployeesPage | Employee list, time log modal |
| `/bookkeeper/customers` | CustomersPage | CRM, customer notes, DaySmart link |
| `/bookkeeper/main-board` | OwnerDashboard | Owner super board |
| `/bookkeeper/daily` | — | Redirects to /overview |

### Operation Overview — Key Architecture
- **Read-only** — never editable; data aggregated from POS, Expenses, Payroll
- Backend: `GET /reports/?start=&end=` → `ReportData`
- Payment counting rule: ALL `WigPayment` records + `PosSalePayment` only for sales with NO wig items (prevents double-counting)
- Every mutation on every page must `invalidateQueries({ queryKey: ['operation-overview'] })`
- `staleTime: 0` on the reports query

### POS — Key Architecture
- Cart item types: `wash_set` | `repair` | `inventory` | `wig` | `wig_balance`
- Per-item tax rate: each `CartItem` carries its own `tax_rate` (0, 0.045, or 0.08875)
- `DEFAULT_TAX_RATE` map drives defaults per item type; user can toggle exempt per item
- Wig balance payments: customer's open balances appear in `OpenBalancePanel`; clicking "Add to Cart" creates a `wig_balance` CartItem (no tax, editable amount)
- Payment auto-fill: single payment row auto-syncs to grand total — Tzipora only picks the method
- Delete sale: explicitly deletes linked WigPayments + InventoryEvents (via `pos_sale_id`), then recomputes wig status from remaining payments
- Receipts: `logo-mark.jpeg` in header; wig sales trigger a second printed page (deposit agreement + warranty + signature fields)

---

## Design Principles

- **No spreadsheet UI** — no Notion-style rows and tables
- **Minimal, modern, high-end** — luxury brand dashboard aesthetic
- **Read-only reporting, write-only entry** — Operation Overview never takes input
- **Interactive dashboards** — Recharts donuts and bar charts
- **AI-powered** — Ella chatbot for plain-language queries
- **Mobile-first for Hani** (Phase 2)

---

## Roadmap

### Phase 1 — Core Web App (current)
- [x] Auth (3 users, 3 roles)
- [x] POS — multi-item cart, wig balance payments as cart items, per-item tax, auto-fill payment, receipt logo + deposit agreement page 2
- [x] Inventory — unified wig + product stock, providers, repair services
- [x] Operation Overview — Day/Month/Range, 5 tabs, Recharts charts
- [x] Expenses — 13 industry-standard categories, add/delete
- [x] Payroll — weekly accordion, clock-in/out, mark paid
- [x] Wig Orders — lifecycle tracking, In Progress / Completed
- [x] Customers CRM
- [x] Employees — time log modal
- [x] AI chatbot (Ella) — 9 tools, /remember command
- [x] All business logic (tithes, sales tax, wig tax deferral) automated
- [ ] Edit sale/receipt (task #8 from Avi meeting)
- [ ] Bank statement auto-import (task #14)
- [ ] Persist unsaved form data on navigation (task #15)
- [ ] DaySmart PDF parsing → auto-fill

### Phase 2 — Mobile
- [ ] Hani mobile experience
- [ ] Avi mobile experience

### Phase 3 — Integrations
- [ ] DaySmart API / PDF auto-import
- [ ] Instagram data
- [ ] WhatsApp integration

---

## Key Files
- `TODO.md` — feature backlog with status and commit hashes
- `june_1_meeting_Avi.md` — full meeting notes and build log
- `Documentation/Reporting_Breakdown.md` — analysis of current Excel workflow
- `backend/app/models/models.py` — all SQLAlchemy models
- `backend/app/routes/reports.py` — Operation Overview aggregation endpoint
- `backend/app/routes/pos_sales.py` — POS sale creation + wig payment logic + delete handler
- `backend/app/core/financials.py` — tithes, sales tax logic
- `frontend/src/pages/bookkeeper/OperationOverviewPage.tsx` — reporting hub
- `frontend/src/pages/bookkeeper/POSPage.tsx` — point of sale
- `frontend/public/logo-mark.jpeg` — salon logo (used on receipts)
- `frontend/public/logo-full.jpeg` — full salon logo
