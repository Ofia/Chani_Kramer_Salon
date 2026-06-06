# The Salon — Open Tasks (updated 2026-06-05)

---

## Phase 1 — Core Flow (active)

| # | Task | Area | Notes |
|---|------|------|-------|
| 8 | **Edit sale / receipt** | POS | Tzipora needs to fix mistakes without deleting and re-entering |
| ~~13~~ | ~~Bank / Cash tag per expense~~ | ~~Expenses~~ | ✅ Done — `3e5dea3` · `79dda34` · ⚠️ run migration 014 |
| 14 | **Bank statement auto-import** | Expenses | Upload bank statement → auto-create expense entries |
| 15 | **Persist unsaved form data** | UX | If user starts a form and navigates away, restore it on return |

---

## Architecture / Redesign

| Task | Area | Notes |
|------|------|-------|
| **Super Board redesign** | Owner Dashboard | Currently reads from DailySummary (dead). Rebuild on `reports.py` — same source as Overview |
| **Ella redesign** | AI Chatbot | `get_daily_summary` tool returns empty. All tools need to be rebuilt around POS/reports data |

---

## Phase 2 — Roles & In-Salon Workflow

| Task | Notes |
|------|-------|
| `sales` role | Floor staff can view inventory + log a sale, print receipt |
| `front_desk` role | Review daily entries, generate daily report |
| Digital handoff | Sales entry → front desk review → auto-queued for Tzipora |
| Distributor payment tracking | When wig flips to `paid_in_full`, flag that distributor needs to be paid |

---

## Phase 3 — Integrations

| Task | Notes |
|------|-------|
| DaySmart PDF parser | Parse daily PDF → auto-fill Tzipora's data entry. Highest-leverage automation |
| Inventory from supplier PDF | Delivery slip → auto-add wigs to inventory |
| Appointments calendar | DaySmart API or in-house |

---

## Open Questions (need Avi)

- Which bank format does the statement parser need to support?
- Full DaySmart service list (Ofir to pull and share)
- Department definitions for P&L Super Board widget
- DaySmart API: direct integration or manual mirror?

---

## ⚠️ Pending Migrations — Run in Supabase SQL Editor

| Migration | File | What it does |
|-----------|------|-------------|
| 011 | `backend/migrations/011_consolidate_wig_orders.sql` | Merges wig_orders into inventory_items |
| 012 | `backend/migrations/012_pos_enhancements.sql` | Adds notes, tax_rate, tax_amount, shipping columns |
| 013 | `backend/migrations/013_expense_categories.sql` | Replaces old categories with 13 industry-standard |
| 015 | `backend/migrations/015_pos_item_tax.sql` | Adds `sale_tax_amount` to inventory_items + `tax_amount` to pos_sale_items |
| ~~016~~ | ~~`backend/migrations/016_inventory_event_pos_sale.sql`~~ | ✅ Run |
