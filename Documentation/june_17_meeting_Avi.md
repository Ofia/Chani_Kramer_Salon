# June 17 Meeting — Avi

**Date:** 2026-06-17
**Attendees:** Avi, Ofir

---

## Issues & Feature Requests

### 1. Mouse Scroll on Number Fields (Bug)
**Pages:** POS, Cart (Sales Management)
When hovering over a sum/price input field and scrolling with the mouse wheel, the browser increments/decrements the numeric value. For example: user types `1000`, accidentally scrolls, value becomes `999.98`.

**Fix needed:** Disable scroll-to-change behavior on all `<input type="number">` fields across POS and cart. Standard fix is `onWheel={(e) => e.target.blur()}`.

---

### 2. Sales History Tab in Operation Overview (Feature)
**Page:** Overview (`/bookkeeper/overview`)

Add a new **Sales History** tab alongside the existing Day / Month / Range views. Requirements:
- Shows every sale, filterable by day / month / date range
- Each sale row is expandable / openable
- **Bookkeeper can edit a sale** — change items, update prices retroactively
- Support **returns and product/wig exchanges** from within this tab
- **Print daily sales list** — Tzipora can print the full list of sales for a given day
- Permission: Bookkeeper role (`tzipora`) can edit; owners are read-only

> Note: This overlaps with task #8 (edit sale/receipt) in the roadmap. Discuss scope before building.

---

### 3. Search Customer by Phone Number (Feature)
**Pages:** Sales Management, Repairs, POS, Customers CRM

All customer search fields currently search by name only. Add phone number as a searchable field — user types digits and matching customers appear.

---

### 4. Repairs Page → Task Management System (Major Feature)
**Page:** Repairs (`/bookkeeper/repairs` or equivalent)

Rebuild the repairs page into a **Clickup-style task management board**. Primary user: **Haya** (repairs manager).

Requirements:
- **Per-wig global status** (e.g. In Progress, Waiting on Parts, Sent to Provider, Done)
- **Per-task status** within each wig (each wig can have multiple repair jobs / tasks)
- Haya can update statuses, add notes, attach videos per task
- **Print a single task** — printable task slip to physically attach to the wig when sending to a service provider
- **Google Drive integration** — each service provider has a linked Google Drive folder; Haya uploads videos explaining the required work; provider sees the folder
- Task board view (Kanban or list) with drag-and-drop or quick status toggle

> Note: Google Drive integration is significant — discuss OAuth scopes and folder structure before building.

---

### 5. Customer History Total Calculation Bug (Bug)
**Page:** Customer history / customer detail

**Incorrect behavior:** Customer bought a wig, paid `$1,000` deposit, had `$2,000` open balance remaining. Later paid the balance. System is summing `$1,000 + $2,000 + $2,000` (double-counting the balance payment).

**Expected:** Total paid = `$1,000 (deposit) + $2,000 (balance payment) = $3,000`. The open balance display and the payment records should not both count toward the total.

---

### 6. External Wig in Cart — Invoice & History (Feature)
**Page:** POS / Sales Management

When an external wig is added to the cart (a wig not in inventory):
- The wig details entered at point of sale must **appear on the printed invoice**
- A **new wig record** should be created in the sold wigs / inventory with its own history log
- From that point forward the wig is trackable in the system (wig history, status, events)

---

### 7. Bank Statement Upload & Expense Reconciliation (Feature — Needs Discussion)
**Page:** Expenses

Context: Expenses are entered daily. At end of month, Tzipora receives a bank statement. The statement only shows the merchant name (e.g. Amazon, AliExpress) — no line-item detail.

**Plan:** Talk to Tzipora first to understand her exact reconciliation workflow and pain points before designing the feature. Do not build until that conversation happens.

---

### 8. Invoice Upload to Product Management (Feature)
**Page:** Product Management (currently Inventory page)

Upload a supplier invoice (PDF) to the Product Management page:
- Parse line items from the invoice
- Preview parsed items in a table
- Bulk-add to inventory with one click

> Note: Invoice import (P1) for wig invoices was already built in session 19. This is the same concept extended to **product/supply invoices** on the Product Management page.

---

### 9. Clock-In / Payroll Integration (Needs Discussion)
**Page:** Employees / Payroll

The salon has a **fingerprint clock-in/out system**. Two options to explore:
1. Direct integration with the fingerprint device/software
2. Upload a weekly Excel export of employee hours

**Plan:** Talk to Tzipora about which option is feasible and what the Excel format looks like before building.

---

### 10. Employee Commission Rules (Feature — Needs Data)
**Page:** Employees

Each employee has commission rules — different rates for different products or services (e.g. a salesperson earns X% on wig sales, Y% on wash & set, etc.).

- Add a **commission rules editor** per employee on the Employees page
- Rules table: product/service type → commission % or flat amount
- Drives commission calculation on payroll

**Plan:** Get the complete commission table from Tzipora before building.

---

## Priority / Next Steps

| # | Item | Status | Action |
|---|------|--------|--------|
| 1 | Scroll-on-number-field bug | Ready to fix | Quick fix, do first |
| 5 | Customer history total bug | Ready to fix | Investigate & fix |
| 3 | Phone search in customer lookup | Ready to build | Straightforward |
| 6 | External wig → invoice + history | Ready to build | Discuss scope |
| 2 | Sales History tab in Overview | Needs discussion | Large feature, plan first |
| 4 | Repairs → Task management + Drive | Needs discussion | Major, plan carefully |
| 8 | Invoice upload to Product Mgmt | Ready to build | Port from session 19 |
| 7 | Bank statement reconciliation | Needs Tzipora input | Wait |
| 9 | Clock-in / payroll integration | Needs Tzipora input | Wait |
| 10 | Commission rules per employee | Needs Tzipora data | Wait |
