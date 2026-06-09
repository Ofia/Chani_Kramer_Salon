# June 9, 2026 — Code Audit: Issues to Fix

Full professional audit of the codebase. All issues flagged against production/industry-standard criteria.

---

## Summary Scorecard

| Area | Grade | Verdict |
|---|---|---|
| Security | **Needs Work** | Role checks are inconsistent, dev bypass is dangerous |
| Error Handling | **Needs Work** | Frontend mutations fail silently |
| Data Integrity | **CRITICAL** | POS sale has no transaction atomicity |
| Code Quality | Good | Well-organized, POSPage too large |
| Performance | Good | Minor N+1 risks in reports |
| State Management | Good | TanStack Query used properly |
| Type Safety | Good | Pydantic + TypeScript solid |

---

## 🔴 CRITICAL — Fix Before Going Live

### C1 — POS Sale Has No Transaction Atomicity
- **File:** `backend/app/routes/pos_sales.py`
- Creates 6+ records (sale → items → payments → inventory → wig payments → events) using individual `db.add()` calls with a single `db.commit()` at the end.
- If any step fails mid-way, the DB is left in a broken state: a sale recorded with no payment, a wig marked sold with no sale record.
- **Fix:** Wrap entire sale creation and deletion in a `with db.begin():` context manager for full atomicity.

### C2 — Dev Bypass Removes ALL Authentication
- **File:** `frontend/src/lib/auth.tsx` (lines 9–10), `frontend/src/lib/api.ts` (line 18)
- If `VITE_SUPABASE_URL` is missing or misconfigured in a deploy, authentication is completely disabled — any request goes through as authenticated.
- **Fix:** Remove the dev bypass entirely. Fail loudly (throw error), not silently open.

### C3 — Role Checks Are Copy-Pasted and Broken
- **Files:** `backend/app/routes/inventory.py` (line 42), `backend/app/routes/providers.py` (line 26)
- Both define a local `_require_bookkeeper_or_owner()` that doesn't actually validate the role correctly.
- Financial routes (`reports.py`, `financials.py`) only require `get_current_user` — any authenticated user can read all company financials.
- **Fix:** Create one canonical `require_bookkeeper_or_owner()` dependency in `backend/app/core/security.py` and apply it to all relevant routes.

---

## 🟡 High Priority

### H1 — Frontend Mutations Fail Silently
- **Files:** `frontend/src/pages/bookkeeper/POSPage.tsx` (saveMutation), `frontend/src/pages/bookkeeper/ExpensesPage.tsx`
- `saveMutation` has no `onError` handler — Tzipora completes a sale, the API fails, she thinks it saved. Data is gone.
- `ExpensesPage` does `.catch(() => [])` — shows an empty list instead of an error message.
- **Fix:** Add `onError` handler to every mutation with a user-facing toast/error message. Never swallow errors silently.

### H2 — Employee Salary Data Exposed to All Authenticated Users
- **File:** `backend/app/routes/employees.py` (line 19)
- `list_employees()` returns `weekly_rate`, `commission_rate`, `hourly_rate` to any logged-in user, including bookkeeper.
- Salary data should be owner-only.
- **Fix:** Add `require_owner` dependency to the salary fields, or return a separate owner-only endpoint with full data.

### H3 — No Audit Log
- No table tracking who changed what and when.
- For a financial system, this is both a compliance and a trust issue. If a bug corrupts data or an entry is disputed, there is no trail to reconstruct from.
- **Fix:** Add an `audit_log` table (migration). Log every financial write: user, action, table, record_id, before/after values, timestamp.

---

## 🔵 Medium Priority

### M1 — POSPage.tsx Is 2000+ Lines
- **File:** `frontend/src/pages/bookkeeper/POSPage.tsx`
- Single component doing too much: cart logic, payment form, receipt printing, wig balance panel.
- **Fix:** Split into subcomponents — `CartSummary`, `PaymentForm`, `ReceiptPrinter`, `OpenBalancePanel`.

### M2 — Race Condition on Inventory Quantity
- **File:** `backend/app/routes/pos_sales.py` (lines 115–117)
- Product inventory decremented with `inv.quantity -= item_data.quantity` without a row lock.
- Two concurrent POS sales on the same product can oversell.
- **Fix:** Use `SELECT FOR UPDATE` (pessimistic lock) or optimistic locking via a version field on `InventoryItem`.

### M3 — N+1 Query in POS Auto-Fill
- **File:** `backend/app/routes/pos_sales.py` (lines 300–350)
- Loops through sales and runs a fresh DB query per iteration to fetch the wig.
- **Fix:** Fetch all relevant wigs in one query before the loop, build a dict keyed by ID.

### M4 — Tax Rates Hardcoded in Frontend
- **File:** `frontend/src/pages/bookkeeper/POSPage.tsx` — `DEFAULT_TAX_RATE` (0.045, 0.08875)
- Tax rates are business logic and should live in the backend, not hardcoded on the client.
- **Fix:** Add a `/config` endpoint returning tax rates; frontend reads from there.

---

## ✅ What's Actually Good (Don't Touch)

- JWT validation and JWKS fetching done correctly in `backend/app/core/security.py`
- SQLAlchemy ORM used throughout — zero SQL injection risk
- TanStack Query invalidation is correct across all pages
- Supabase auth subscription cleanup is correct in `frontend/src/lib/auth.tsx`
- Pydantic schemas are solid — type safety at API boundary
- Business logic (tithes, tax rules, wig revenue recognition) centralized in `backend/app/core/financials.py`
- CORS locked to specific origins in `backend/app/main.py`
- No hardcoded secrets — env-based config throughout

---

## Recommended Fix Order

| Priority | Issue | Effort |
|---|---|---|
| 1 | C1 — Transaction atomicity on POS sale | ~2 hrs |
| 2 | C2 — Remove dev auth bypass | ~15 min |
| 3 | C3 — Centralize role dependency | ~1 hr |
| 4 | H1 — onError handlers on all mutations | ~2 hrs |
| 5 | H2 — Restrict salary data to owner | ~30 min |
| 6 | H3 — Audit log table | ~3 hrs |
| 7 | M1 — Split POSPage into subcomponents | ~3 hrs |
| 8 | M2 — Row lock on inventory quantity | ~1 hr |
