# Access Database Import Plan

## Context
Avi's salon runs a legacy Microsoft Access database (`Sheitel.mdb`) for customer management, wig inventory, orders, repairs, and payments. Until our app is fully built and adopted, Access will remain live — Avi will periodically export it. This document explains the import strategy and what was built.

---

## What's in the Access Export

| Table | Rows | Contents |
|---|---|---|
| **Customers** | 6,914 | Full customer list — name, address, phone, cell |
| **Item** | 13,460 | Wig inventory — wig#, company, style, color, length, size, cost, retail |
| **Order** | 33,842 | Order headers — customer, date, total, tax, payment, balance |
| **Order_Dtl** | 75,042 | Order line items — wig specs, service descriptions, paid status |
| **Payments** | 45,374 | Payment ledger — amount, date, method (Cash / Credit Card), auth numbers |
| **Repair** | 17,564 | Repair jobs — work description, status, cost, price, customer dates |
| **ScanItem** | 43,701 | Inventory movements — wig in/out log per wig number |
| **Company** | 40 | Supplier list — YAFI, SARY, EVA & CHLOE, IRENE, etc. with markup rules |

---

## 1. Incremental Import Strategy (No Duplicate Energy)

### The Problem
Access stays live and gets new data. Every future export will include both old data and new rows. We can't blindly re-import everything — that would overwrite our own CRM notes, create duplicates, and waste time.

### The Solution: Upsert by External Key
When we first import from Access, we store the **Access row ID** in our own tables as a separate column (`access_id`). On every future export:

- Row exists with that `access_id` → **UPDATE** (sync any changes Access "owns", e.g. phone number)
- Row doesn't exist → **INSERT** (new record added in Access since last export)
- Row in our DB but not in the new export → **LEAVE IT ALONE** (may have been added by us directly)

```sql
-- Pseudo-code: safe upsert on Customers
INSERT INTO customers (access_id, first_name, last_name, phone, cell, address)
VALUES (...)
ON CONFLICT (access_id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name  = EXCLUDED.last_name,
  phone      = EXCLUDED.phone,
  cell       = EXCLUDED.cell,
  address    = EXCLUDED.address;
  -- DO NOT overwrite: notes, created_at, daysmart_client_id
  -- These are "our" fields — Access doesn't know about them
```

### Implementation
A Python import script (`scripts/import_access.py`) reads the exported Excel files and runs the upsert. Avi exports → Tzipora runs the script → done in ~30 seconds. No manual cleanup needed.

### Fields Owned by Each System
| Field | Owner | Behavior on re-import |
|---|---|---|
| `first_name`, `last_name`, `phone`, `cell`, `address` | Access | Overwrite |
| `notes` | Our app | Never overwrite |
| `daysmart_client_id` | DaySmart | Never overwrite |
| `access_id` | Access | Match key, never change |

**Status: ✅ Done** — `access_id` column added to `customers` table (migration `004_customers_access_id.sql`)

---

## 2. Customers Page (CRM)

A dedicated Customers page was added to the sidebar, placed below Employees (same "not time-dependent" group). Each customer has a CRM-style profile drawer.

**List view columns:** Name, Phone, City, Customer Since date
**Profile drawer (click any row):**
- Full contact info (phone, cell, address)
- Notes field (editable, saved independently)
- Customer since date
- Edit button for full contact info update

**Routes:**
- Frontend: `/bookkeeper/customers`
- Backend: `/customers/` (GET, POST, PATCH — already existed)

**Status: ✅ Done** — `CustomersPage.tsx` built, route added, sidebar entry added

---

## 3. AI Access Strategy — Hybrid SQL + Vectors

### Decision: Don't vectorize everything. Use SQL for numbers, vectors for text.

| Query type | Tool |
|---|---|
| "How much did we make in April?" | SQL — exact aggregation |
| "Which customers still owe money?" | SQL — precise calculation |
| "Find a customer named Leah, last name like Greenfeld" | Vector — handles typos/fuzzy |
| "What repairs did we do for that lady with the highlights order?" | Vector — semantic meaning |

### Architecture
- **Structured data** (orders, payments, revenue) → PostgreSQL → Ella queries with SQL tools (already built)
- **Unstructured text** (repair work descriptions, customer notes, order notes) → embed with `text-embedding-3-small` → store in `pgvector` → new Ella tool: `search_customer_history(query)`

### What NOT to vectorize
Don't embed 75k orders row by row. SQL handles quantity/date/amount questions better and cheaper. Only vectorize **prose fields**: `WorkDesc` from Repair, `Note` from Orders, customer notes.

**Status: 🔲 Future** — add `search_customer_history` tool to Ella when Access data is imported

---

## 4. Wig Inventory — Past Records vs. Current Availability

The `Item` table (13,460 rows) is **both** — a catalog of all wigs ever, with current availability signaled by:
- `InStoct` (boolean) field → current availability flag
- `ScanItem` table (43,701 rows) → movement ledger (in/out log per wig)
- `Stock_Step1.sql` derives net position by summing `In_Out` per wig number

**For our app:**
- Import `Item` → seed a wig catalog / inventory page (future)
- `InStoct = true` → available; `ScanItem` net sum = 0 → balanced inventory
- ScanItem log → movement history timeline per wig (useful for Avi to see sell-through rates)

**Status: 🔲 Future** — build wig catalog page when ready to import

---

## Supplier List (Quick Win)

The 40 companies from `Company.xlsx` are the real vendors:
`YAFI, SARY, EVA & CHLOE, IRENE, ...`

These should be a dropdown in the Wig Orders entry form instead of free-text. Low effort, high value.

**Status: 🔲 Future** — add to Wig Orders form dropdown

---

## Future Script: `scripts/import_access.py`

Will be a Python script that:
1. Reads the exported Excel files from `Reports_from_Avi/Access/csv_tables/`
2. Upserts customers by `access_id`
3. Upserts wig inventory by `access_id`
4. Reports: X inserted, Y updated, Z skipped

To run after each Avi export:
```bash
cd backend
python scripts/import_access.py
```
