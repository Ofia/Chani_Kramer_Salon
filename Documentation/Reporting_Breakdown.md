# Wig Salon Reporting System — Analysis & Planning

## What I Found in `tamplate רווחים.xlsx`

### The 4 Sheets

---

### 1. `הכנסות` — Revenue (daily, per month)
One row per day (31 rows), columns track:

| Column | What it is |
|---|---|
| W&S Profit | Wash & Set revenue |
| Wigs Profit | Wig sales revenue |
| Repairs Profit | Repair service revenue |
| Total Income | Auto-sum of above 3 |
| רווח אחרי הוצאות | Profit after expenses (pulls from הוצאות sheet col AL) |
| 40% לבנק | 40% of net profit auto-allocated to bank/savings |
| רווח לפני מעשרות | Profit before tithes |
| מעשרות של ה 20% | Tithes on the 40% bank portion (`G * 0.91125 / 10` — removes 8.875% NY sales tax first, then takes 10%) |
| מעשרות | Tithes on the remaining portion (`H / 10`) |
| Total Profit | After tithes |
| רווח פרטי + בנק - מעשרות | Owner take-home |
| Payment methods | Cash, Quickpay, Credit Card, Check (tracked separately) |
| New Wigs Sold | Count |
| Wigs Paid in Full | Count |
| Chani cuts | Count of Chani's personal cuts |

**Key insight:** There's a religious financial practice built in — tithes (מעשרות) are calculated as a real business expense, and sales tax is stripped out before computing them. This is a non-trivial business rule that any new system must preserve.

---

### 2. `הוצאות` — Expenses (daily, same structure)
**38 columns.** One row per day. This is the most complex and painful sheet.

**Payroll columns (19 stylists!):**
Vicki, Dalia, Tzipora, Ariella, Dominga, Raizy, Chaya Suri, Chavy, Rosy, Eitz, Perela, Chani B, Raizy S, Roxana, Alla, Michelle, Gabriella, Yehudit, Karla — each gets their own column, entered daily.

**Owner cuts:**
- Cuts by Chana Hinda
- Cuts by Chani

**Other fixed cost columns:**
- איציק (Itzik — handyman/maintenance)
- Grossman (supplier)
- נהג מונסי (Monsey driver)
- שכירות (rent)
- טלפון ואינטרנט (phone & internet)
- Hair (supply purchases)
- Shipping
- Dalia Instagram (social media paid separately)
- יוכבד אחוזים / Ariella % (commission-based staff)
- הוצאות שונות (misc)
- extra/missing (reconciliation column!)
- קניות לעבודה (work purchases)
- אוכל (food/meals)
- Sales tax

**Critical finding:** Months are stacked **vertically** in this sheet (rows 34+ = another month, row 55 shows יולי/July). This means the entire sheet grows indefinitely with no structure between months.

---

### 3. `הפקדות` — Deposits (daily bank log)
Simple 6-column daily record:
- Cash deposited
- Checks deposited
- Credit card deposited
- Sales tax on cash (auto: `cash × 8.875%`)
- Sales tax on CC/Checks (formula: `checks + CC × 4.5%`)

This is a **3rd place** where revenue gets entered — same money entered in הכנסות, then again here.

---

### 4. `הוצאות על המקום החדש` — New Location Expenses
A simple one-off list of buildout costs (Shira $1,000, Carlos $3,100). Basically a scratch pad — not integrated with anything.

---

## The Core Problems I See

### Data entry hell
| Problem | Impact |
|---|---|
| **Triple entry** — same day's revenue is entered in הכנסות, then again in הפקדות | ~2× work, high error risk |
| **38-column expense sheet** — one column per stylist, entered daily | Unusable on mobile, breaks when staff changes |
| **Months stacked vertically** — no separation, no navigation | Finding last month requires scrolling through hundreds of rows |
| **Cross-sheet formula dependency** (`הוצאות!AL2`) | One inserted row breaks all revenue calculations |

### Business logic buried in formulas
- The tithes calculation (0.91125/10) is invisible to anyone who didn't build it
- 40% bank allocation rule is hardcoded, not labeled
- Sales tax rates (8.875%, 4.5%) are hardcoded in cells with no documentation

### No structure for time
- The monthly ops file (Nov–Jan) is a completely different format from this template — meaning the reporting system has already drifted/changed
- No way to compare months without manually looking across files

### What's missing entirely
- No payroll summary per stylist per month
- No view of which revenue stream (W&S vs Wigs vs Repairs) is most profitable
- No cash flow tracking between deposit sheet and expense reality
- No alert when tithes need to be paid
- Nothing for the owner to look at quickly on their phone

---

## What I Understand About the Workflow

Based on both files, here's what I think happens daily/monthly:

1. **End of each day** — someone (bookkeeper?) opens the expenses sheet and enters each stylist's pay for that day in their column
2. **End of each day** — same person or owner enters revenue breakdown (W&S / Wigs / Repairs) in הכנסות
3. **End of each day** — deposits are logged in הפקדות
4. **End of month** — someone manually assembles a summary (like the Nov–Jan file) to compute overall profit, expenses, etc. — this involves copy-pasting and rewriting formulas
5. **Bookkeeper** also tracks one-time expenses separately (the credit card transactions in the monthly ops file)

---

## Open Questions (to confirm before planning)

1. **Who enters data and when** — owner? bookkeeper? front desk? - front desk collects everything and hand the bookkeeper for daily bookkeeping
2. **Is stylist pay entered daily**, or weekly/end of month? - Weekly
3. **What does the 40% bank rule mean** exactly — savings? Tax reserve? - The Salon keeps 40% of the income deposited to the bank (some income is kept in cash in the safe). It is balanced by the bookkeeper on a daily basis (Cash vs. Credit cards or wire being calculated that 40% will be deposited in the bank, or cash will be kept in the safe)
4. **Are the two files** (this template + the monthly ops file) used by the same person or different people? - yes

---

## Next Steps

- Confirm workflow understanding with answers to the open questions above
- Redesign the reporting system to be simpler, mobile-friendly, and automated where possible
- Define new tools for the bookkeeper and the owners
- Plan automations
- Design a scalable system/product for this type of business
