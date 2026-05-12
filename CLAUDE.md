# The Salon — Beauty Salon Management System


## GitHub Repo:
https://github.com/Ofia/Chani_Kramer_Salon.git



## Project Overview
A high-end, modern web application for a successful wig salon in Brooklyn, NY.
Replacing a painful Google Sheets workflow with an intelligent, interactive system.

**Core philosophy:** Everything works in the backend. The UI surfaces only what each user needs — clean, minimal, interactive, never a spreadsheet.

---

## The Three Users

### Tzipora — Bookkeeper
- Primary daily user
- Responsible for all data entry and bookkeeping
- Enters: stylist pay (weekly), daily revenue, deposits, expenses
- Needs: fast, guided data entry flows — not a table to fill in
- Device: Desktop (primary)

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
2. **Wig Sales** — product revenue
3. **Repairs** — service revenue

### Daily Revenue Tracking
- Revenue broken down by stream per day
- Payment method tracked: Cash, QuickPay, Credit Card, Check
- New wigs sold (count) and wigs paid in full (count) tracked separately
- Chani cuts tracked separately (owner's personal service)

### The 40% Bank Rule
- 40% of net income is deposited to the bank daily
- Remaining 60% may be kept as cash in the safe
- The bookkeeper reconciles daily: Cash vs. Credit/Wire to ensure 40% lands in bank

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
- **CC/Check rate:** 4.5% (different rate for non-cash)
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
Total Revenue (W&S + Wigs + Repairs)
  - Total Expenses
= Net Profit (רווח אחרי הוצאות)
  × 40% → Bank Portion
  Remaining → Owner Portion
Bank Portion → strip sales tax → ÷ 10 = Bank Tithes
Owner Portion → ÷ 10 = Owner Tithes
Net Profit - All Tithes = Final Take-Home
```

### Deposits
- Cash, Checks, Credit Card logged daily
- Sales tax auto-calculated per method
- Must reconcile with revenue entries

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
- [ ] Auth (3 users, 3 roles)
- [ ] Tzipora: Daily data entry flows (revenue, expenses, deposits)
- [ ] Tzipora: Weekly payroll entry
- [ ] Avi: Dashboard — revenue breakdown, profit trend, expense analysis
- [ ] Hani: Summary view — net result only
- [ ] AI chatbot — query the data in plain language
- [ ] All business logic (tithes, 40% rule, sales tax) automated in backend

### Phase 2 — Mobile
- [ ] Hani mobile experience
- [ ] Avi mobile experience

### Phase 3 — Integrations
- [ ] Instagram data
- [ ] WhatsApp integration
- [ ] All external data sources

---

## Tech Stack (TBD — pending UI direction)
- Frontend: React (likely) — component-based, supports rich interactive dashboards
- Backend: Node.js / Python — to be decided
- Database: PostgreSQL (structured financial data) — to be decided
- AI: Claude API for chatbot and insights

---

## Key Files
- `Documentation/Reporting_Breakdown.md` — full analysis of current Excel workflow
- `Reports_from_Avi/` — source Excel files from current system
