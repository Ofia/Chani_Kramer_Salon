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
| 1 | Scroll-on-number-field bug | ✅ Done (Session 23) | `main.tsx` passive wheel listener |
| 5 | Customer history total bug | ✅ Done (Session 23) | `42de759` — removed `+ wig_balance_total` double-count |
| 3 | Phone search in customer lookup | ✅ Done (Session 24) | POS `cell→phone` fix; Repairs pill shows `phone \|\| cell` |
| 6 | External wig → invoice + history | ✅ Done (Session 24) | Sold Items $0, "Added from external" note, receipt serial, dynamic dept banner |
| 2 | Sales History tab in Overview | ✅ Done (Session 24) | 6th tab, range endpoint, edit items, print receipt + daily list — commit `c78759c` |
| 4 | Repairs → Task management + Drive | ✅ Done (Session 25) | repair_tasks table, per-task status/provider/print, expandable rows, centered create modal — commits `5a98acd`–`b6b3bac` |
| — | POS repair UX polish | ✅ Done (Session 26) | Status chip in pending banner, wig serial in cart row, full-screen print preview — commits `112e05d`–`11a1328` |
| 8 | Invoice upload to Product Mgmt | ✅ Done (Session 27) | AI-based product invoice import, any marketplace — commit `adf8b3a` |
| 7 | Bank statement reconciliation | ➡️ Carried to June 25 (#13) | Needs Tzipora input |
| 9 | Clock-in / payroll integration | ➡️ Carried to June 25 (#12) | Payroll redesign (TimeDocs drop) — needs Tzipora data |
| 10 | Commission rules per employee | ➡️ Carried to June 25 (#11, #12) | Get employee table from Tzipora first |

---

## Session 24 — 2026-06-19

### Completed

**Task #3 — Phone search audit**
- Backend already searched `phone` field; bug was in POS `createCustomerMutation`: was sending `cell: newPhone` instead of `phone: newPhone` — 1-line fix
- Repairs pill: `renderItem` now shows `c.phone || c.cell`; `sub` prop uses same fallback
- All other search fields (Sales Management, Customers CRM, POS) were already correct

**Task #6 — External wig tracking**
- `is_external: bool = False` added to `InventoryItemCreate` schema
- Inventory POST: when `is_external=True` → sets `retail_price=0`, `cost_price=0`; creates `"Added from external on {date}"` note event instead of "arrived" event; wig_status=sold
- `_build_response` in `cart.py`: derives `wig_serial` from `repair_order.inventory_item.daysmart_serial` relationship when not already set
- POSPage receipt: "Wig: {serial}" sub-line under repair item descriptions
- POSPage banner: "waiting from Repairs" (dynamic from `p.department`, not hardcoded "Sales")
- TypeScript fix: `department: string` added to `PendingCartItem` local type in POSPage

**Task #2 — Sales History tab**
- `GET /pos-sales/?start=&end=` range endpoint (newest first)
- `PUT /pos-sales/{sale_id}/items` bulk-edit endpoint: edit/add/remove non-wig items, wig items price-only, recalculates totals, audit logs on linked wigs — bookkeeper/owner only
- `PosSaleItemEdit` + `PosSaleBulkEdit` schemas added
- `SalesHistoryTab` as 6th tab in `OperationOverviewPage.tsx`: sales grouped by date, expandable rows, editable items table (non-wig: description/price/tax/notes/delete; wig: price + badge), add item row, discount field, live totals preview, Save Changes / Print Receipt / Delete Sale actions, Print Daily List button (condensed monospaced format)
- Commit: `c78759c`

---

## Session 25 — 2026-06-22

### Completed

**Task #4 — Repairs → Task Management System**
- Google Drive integration deferred (Haya will share Drive folder links manually — video URL field used instead)
- `repair_tasks` table (migration 026): per-task status enum (`pending | in_progress | with_external | done`), `assigned_provider_id`, `notes`, `video_url`, `created_by`; `repair_task_id` FK added to `pending_cart_items` for clean cart linkage
- `RepairTask` model + `RepairTaskStatus` enum added to `models.py`; `RepairOrder.tasks` relationship; `PendingCartItem.repair_task_id` column
- New `repair_tasks.py` route: `POST /repair-tasks/` auto-creates linked `pending_cart_item` so POS sees it immediately; `PATCH` syncs price/description to cart item; `DELETE` removes cart item too
- `repair_orders.py` `_build_response` now includes full tasks array
- `cart.py` + `CartItemResponse`: added `repair_order_status` field — front desk can see global repair status (In Progress / Ready for Pickup) on any cart view
- `RepairsPage.tsx` fully rebuilt:
  - "New Order" button → centered popup modal (not slide-in panel): customer + wig + task list (service · provider · price on row 1; notes · drive link on row 2)
  - Repair orders list: expandable cards, tasks shown inline
  - Per task: colored status chip (click to cycle through statuses), description, price, video link icon, print slip, expand arrow → editable section (provider dropdown, notes, drive link, Save/Cancel)
  - Global order status buttons at bottom of expanded card (`Pending → In Progress → With External → Ready for Pickup`)
  - Print task slip: opens new window with service, provider, instructions, video link — no price
  - Active Carts tab: repair order status chip shown next to customer name
- `BookkeeperLayout.tsx`: `repairs` role can now see Product Management (read-only)
- Haya user: `repairs` role already in DB (migration 024) — create via Supabase Auth + set role in `users` table

---

## Session 26 — 2026-06-22

### Completed

**POS Repairs UX Polish (3 fixes)**

- **Repair order status chip in pending banner** (`POSPage.tsx`): `repair_order_status` was already populated in `CartItemResponse` from `cart.py`; added `repair_order_status?: string` to local `PendingCartItem` type + inline colored chip in the pending banner JSX using `STATUS_STYLES`/`STATUS_LABELS` maps — commit `112e05d`
- **Wig serial in repair cart row** (`POSPage.tsx`): `wig_serial` was already mapped in `loadPendingCart` for all item types; added `Wig: {serial}` sub-line below description for `item_type === 'repair'` rows using `s.cartRowNotes` style — commit `0420374`
- **Print slip full-screen popup** (`RepairsPage.tsx`): popup was opened at `width=400,height=600` — too small for Chrome's side-by-side print preview UI; changed to `width=${screen.width},height=${screen.height},left=0,top=0` — commit `11a1328`
