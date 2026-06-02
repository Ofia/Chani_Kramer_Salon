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
