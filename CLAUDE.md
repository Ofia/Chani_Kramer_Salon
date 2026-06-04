# The Salon — Beauty Salon Management System


## GitHub Repo:
https://github.com/Ofia/Chani_Kramer_Salon.git


## Deployment
- **Database + Auth:** Supabase (PostgreSQL + Supabase Auth)
- **Backend:** Runs locally via `uvicorn app.main:app --reload` (no cloud deploy yet)
- **Frontend:** Runs locally via `npm run dev` (deployed on Vercel)
- **Migrations:** Run SQL files manually in Supabase SQL Editor


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
- **Frontend:** React + TypeScript + Vite, TanStack Query, React Router, Lucide icons
- **Backend:** FastAPI (Python), SQLAlchemy ORM, Pydantic schemas
- **Database:** PostgreSQL on Supabase
- **Auth:** Supabase Auth (JWT passed as Bearer token to FastAPI)
- **AI:** Claude API (claude-sonnet-4-6) — Ella chatbot with tool use loop


## Project Overview
A high-end, modern web application for a successful wig salon in Brooklyn, NY.
Replacing a painful Google Sheets workflow with an intelligent, interactive system.

**Core philosophy:** Everything works in the backend. The UI surfaces only what each user needs — clean, minimal, interactive, never a spreadsheet.

---

## The Three Users

### Tzipora — Bookkeeper
- Primary daily user
- Responsible for all data entry and bookkeeping
- Enters: stylist pay (weekly), daily revenue, deposits, expenses, wig orders
- Needs: fast, guided data entry flows — not a table to fill in
- Device: Desktop (primary)
- Daily workflow: receives 4 docs — DaySmart daily report (PDF), CC batch, Zelle bank report, handwritten sales slips

### Avi — Owner / COO
- Needs elaborative reports and business analysis
- Wants to understand trends, profitability by service, stylist efficiency
- Needs: interactive dashboards, drill-down views, AI-powered insights
- Device: Desktop + Mobile (Phase 2)

### Hani — Owner
- Results only: how much was made, how much was spent
- No detail, no noise — just the number and whether it's good or bad
- Needs: a single-screen summary, always up to date
- Device: Mobile (Phase 2 priority)

---

## Business Logic (Critical — Do Not Simplify Away)

### Revenue Streams
1. **Wash & Set (W&S)** — service revenue
2. **Wig Sales** — product revenue (**recognized only when wig is paid in full**)
3. **Repairs** — service revenue

### Wig Revenue Recognition (CRITICAL)
**Deposits are NOT revenue.** A wig deposit is a cash-flow event — the wig hasn't been delivered yet.
- Revenue from wig sales is only recorded when `status = paid_in_full`
- `wig_deposits_total` on `daily_summary` tracks deposit cash for bank reconciliation only
- This is standard accrual accounting

### Wig Lifecycle
`ordered` → `ready` → `paid_in_full`
- **ordered:** deposit paid, wig being made/sourced
- **ready:** wig arrived at salon, client hasn't picked up
- **paid_in_full:** fully paid and picked up — revenue recognized here
- Status auto-advances when `amount_paid >= total_price`

### Daily Revenue Tracking
- Revenue broken down by stream per day
- Payment method tracked: Cash, QuickPay, Credit Card, Check, Zelle
- New wigs sold (count) and wigs paid in full (count) tracked separately
- Chani cuts tracked separately (owner's personal service)
- `wig_deposits_total` separated from revenue


### Tithes (מעשרות) — Religious Financial Practice
This is a real, non-negotiable business rule:
- **Bank portion tithes:** `(bankAmount × 0.91125) / 10`
  - First strip NY sales tax (8.875%): `× 0.91125`
  - Then take 10% tithe
- **Remaining profit tithes:** `remainingProfit / 10`
- Sales tax is always removed before tithes are calculated
- These are treated as a real expense line, not optional

### Sales Tax
- **NY Sales Tax rate:** 8.875%
- Applied to cash revenue in deposit calculations
- **CC/Check/Zelle rate:** 4.5% (different rate for non-cash)
- Always stripped before tithe calculation

### Expenses — Payroll
- 19 stylists currently: Vicki, Dalia, Tzipora, Ariella, Dominga, Raizy, Chaya Suri, Chavy, Rosy, Eitz, Perela, Chani B, Raizy S, Roxana, Alla, Michelle, Gabriella, Yehudit, Karla
- Stylist pay is entered **weekly** (not daily)
- Owner cuts tracked separately: Chana Hinda, Chani
- Commission-based staff: Yocheved (%), Ariella (%)

### Expenses — Fixed & Variable
- Itzik (maintenance/handyman)
- Grossman (supplier)
- Monsey driver (נהג מונסי)
- Rent (שכירות)
- Phone & Internet
- Hair supplies
- Shipping
- Dalia Instagram (social media)
- Misc expenses (הוצאות שונות)
- Reconciliation/extra/missing column
- Work purchases (קניות לעבודה)
- Food/meals (אוכל)
- Sales tax

### Profit Calculation Chain
```
Total Revenue (W&S + Wigs [paid_in_full only] + Repairs)
  - Total Expenses
= Net Profit (רווח אחרי הוצאות)
  × 40% → Bank Portion
  Remaining → Owner Portion
Bank Portion → strip sales tax → ÷ 10 = Bank Tithes
Owner Portion → ÷ 10 = Owner Tithes
Net Profit - All Tithes = Final Take-Home
```

### Deposits
- Cash, Checks, Credit Card, Zelle logged daily
- Sales tax auto-calculated per method
- Must reconcile with revenue entries

---

## DaySmart Integration
The salon uses **DaySmart** as their POS/appointment system. This app is the financial intelligence layer on top.
- Do NOT suggest POS features (scheduling, appointments) — DaySmart handles that
- DaySmart assigns serial numbers to wigs (e.g. "rina44871", "HP33738", "BK12345")
- These are stored in `wig_orders.daysmart_serial`
- **Future goal:** Parse DaySmart daily PDF reports to auto-fill wig order forms

---

## Database Schema (13 tables, live on Supabase)

### Migration 001 — Core Tables
`users`, `employees`, `customers`, `sales_transactions`, `transaction_payments`,
`daily_summary`, `expense_entries`, `weekly_payroll`, `deposits`,
`financial_snapshots`, `ai_conversations`, `ella_facts`

### Migration 002 — Wig Orders (`migrations/002_wig_orders.sql`)
- `wig_orders` — one row per physical wig, tracks full lifecycle
- `wig_payments` — each payment event (deposit/partial/final)
- New enums: `wig_status`, `wig_payment_type`
- New `daily_summary` column: `wig_deposits_total`

**Supabase enum naming:** Always snake_case in SQL (`wig_status`, not `wigstatus`).
In SQLAlchemy, always pass `name=` explicitly: `Enum(WigStatus, name='wig_status')`

---

## Design Principles

- **No spreadsheet UI** — no Notion-style rows and tables
- **Minimal, modern, high-end** — think luxury brand dashboard
- **Interactive dashboards** — charts, cards, drill-downs
- **AI-powered** — chatbot for queries, insights surfaced automatically
- **Guided flows** — Tzipora should be walked through data entry, not dropped in a form
- **Mobile-first for Hani** (Phase 2)

---

## Roadmap

### Phase 1 — Core Web App
- [x] Auth (3 users, 3 roles)
- [x] Tzipora: Daily data entry flow (Activity → Payments → Expenses → Revenue → Review)
- [x] Tzipora: Wig order entry + payment tracking
- [x] Wig Orders page (In Progress / Completed tabs)
- [x] Avi: Dashboard — revenue breakdown, profit trend, expense analysis
- [x] AI chatbot (Ella) — query the data in plain language
- [x] All business logic (tithes, 40% rule, sales tax) automated in backend
- [ ] Tzipora: Weekly payroll entry (UI exists, verify flow)
- [ ] DaySmart PDF parsing → auto-fill wig order form

### Phase 2 — Mobile
- [ ] Hani mobile experience
- [ ] Avi mobile experience

### Phase 3 — Integrations
- [ ] DaySmart PDF auto-import
- [ ] Instagram data
- [ ] WhatsApp integration

---

## Key Files
- `Documentation/Reporting_Breakdown.md` — full analysis of current Excel workflow
- `Reports_from_Avi/` — source Excel files from current system
- `backend/app/models/models.py` — all SQLAlchemy models
- `backend/app/routes/wig_orders.py` — wig lifecycle API
- `backend/app/core/financials.py` — tithes, 40% rule, sales tax logic
- `backend/migrations/002_wig_orders.sql` — run in Supabase SQL Editor
- `frontend/src/pages/bookkeeper/DailyEntryPage.tsx` — Tzipora's main entry flow
- `frontend/src/pages/bookkeeper/WigOrdersPage.tsx` — wig tracking dashboard
