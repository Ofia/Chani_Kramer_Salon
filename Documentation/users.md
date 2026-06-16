# User Management

## Roles & Access

| Role | Who | Access |
|------|-----|--------|
| `owner` | Avi, Hani | Everything |
| `bookkeeper` | Tzipora | Almost everything (no Super Board) |
| `sales` | Sales dept | Hello Board, Calendar, Sales Management, Product Management, Customers |
| `front_desk` | Front Desk | Hello Board, Calendar, Point of Sale, Customers |
| `repairs` | Repairs dept | Hello Board, Calendar, Repairs, Customers |

---

## How to Create a New User

### Step 1 — Create the Auth account in Supabase
Go to: **Supabase Dashboard → Authentication → Users → Add user → Create new user**

Enter email + password. After creation, copy the **User UID** (looks like `a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

### Step 2 — Insert into the `users` table
Go to: **Supabase Dashboard → SQL Editor** and run:

```sql
INSERT INTO users (id, supabase_uid, name, email, role)
VALUES (
  gen_random_uuid(),
  'PASTE-SUPABASE-UID-HERE',
  'First Last',
  'email@example.com',
  'sales'   -- one of: owner / bookkeeper / sales / front_desk / repairs
);
```

---

## Users to Create

| Person | Email | Role | Status |
|--------|-------|------|--------|
| Avi | — | `owner` | ⬜ |
| Hani | — | `owner` | ⬜ |
| Tzipora | — | `bookkeeper` | ⬜ |
| Sales | — | `sales` | ⬜ |
| Front Desk | — | `front_desk` | ⬜ |
| Repairs | — | `repairs` | ⬜ |

---

## Verify Existing Users

To see all current users and their roles:

```sql
SELECT supabase_uid, name, email, role, created_at FROM users ORDER BY created_at;
```
