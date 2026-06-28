# June 25 Meeting — Avi

## Raw Prompt (as given)

1. in the new appointment dialogue in the calander, we need to add under the duration and deprtment fields two more fields: "employee" with a dropdown of all employees and "service" with a dropdown of all the services the salon offers.

2. in the employees page we need to add to the employee profile also the department dropdown catagory: frontdesk, sales, Cut, w&s, Repairs, bookkeeping, owner.

3. We need to create a page that is made for mobile to see the calander in an easy way and to have the option to upload images/videos (this one is a bit more complicated becasue it involves an integartion to google drive)

4. we need to add an edit to all options that were added to an item in the repairs department which was already added to the cart. (active repair)

5. in the sale hitory tab in th eoverview page we need to add to each sale row all the details of that sale (wig serial number, color, etc, client, price - everythign we have in daysmart)

6. add edit option to the price of a product that was uploaded via invoice parser dialogue. (atm we can change the retail price or the markup, but we want to also correct if needed the cost price)

7. this one we need to discuss: when the salon buys products (alibaba for example) the expense is made at that moment, but the product might arrive in a few weeks. we want to add the invoice to the expenses and choose the expenses catagory. if the category is "Cost of goods sold" this is saved in expenses but also is created in the product management page, in a new tab called "Pending Orders" where we will have these items from the parser waiting to be added to the inventory. once the package arrived, it is checked against the pending order and then can be added to the products inventory. we need to discuss the best practice of this and how do expenses are handled in quickbooks.

8. in the day view of the calander, we need to have columns for each employee that has appointment that day and in the weekly or monthly, we need to see a list of all apopintments when we click the event.

9. for the customers card we need to add email field, break the address to: address, city, state, zip code, and integrate something that autofills addresses (start typing and you can see the address options) and also to add address 2 filed (for extra details)

10. we need to remove the "(for commision)" in the sale representative field and the stylist field in the sales managment and w&s add item dialogues.

11. I need to ask Tzipora for a table of all employees names, emails, their employee number, department, position, and their commision rules.

12. Payroll page redesign - we will just drop a file from TimeDocs that has the entire week's log and by identifying employee numbers we'll calculate their salaries. each employee will get a row, which can be edited (like we have now - cash/bank, etc) and a paid status switcher. once an entire week's payroll work is done it can be saved and accessed by choosing the date in our date selctor.
On the same page we will add a commision tab where commission in auto added to employees from sales and w&s, accumulate and being paid once a month, again with editing option for the sum and a status button to confirm its paid.

13. we need to build a tool that compairs the monthly credit card bank statement to the expenses from that month.

14. we need to add a service that sends SMS/Whatsapp notifications to clients that their appointments were booked as DaySmart does.

15. very important to do next week: clean all test data and upload real data from access.

---

## Task Breakdown

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Calendar — add Employee + Service dropdowns to new appointment dialog | ⬜ TODO | Pull from employees table + repair_services/services |
| 2 | Employees page — add Department field (frontdesk, sales, Cut, w&s, Repairs, bookkeeping, owner) | ⬜ TODO | New enum or string field on employees table |
| 3 | Mobile calendar page + Google Drive image/video upload | ⬜ TODO | Complex — Google Drive OAuth integration |
| 4 | Repairs Active Cart — edit options on already-added repair items | 🔧 PARTIAL | Built: clicking item row opens full Edit Repair Order dialog (pre-populates customer, wig, tasks). Fine-tuning needed: (a) same edit option should also be accessible from Repair Orders tab (currently only in Active Carts); (b) no visual affordance on row — add pencil icon or chevron so user knows it's clickable |
| 5 | Sales History tab — expand sale rows to show all DaySmart details (serial, color, client, price…) | ⬜ TODO | Expand row detail view in OperationOverviewPage |
| 6 | Invoice parser — editable cost price (not just retail/markup) | ✅ DONE | Cost cell is now editable in product invoice preview; markup/unit price recalculate on change |
| 7 | Pending Orders flow — CoGS expense → Pending Orders tab → check-in to inventory | ⬜ DISCUSS | QuickBooks best practice: expense at PO date or receipt date? |
| 8 | Calendar Day view — columns per employee; Week/Month — appointment list on click | ⬜ TODO | CalendarPage layout change |
| 9 | Customers CRM — add email, split address fields, Google Places autocomplete, address 2 | ⬜ TODO | Google Maps Places API |
| 10 | Remove "(for commission)" label from Sales Management + W&S dialogs | ✅ DONE | |
| 11 | Get employee table from Tzipora (names, emails, emp#, dept, position, commission rules) | ⬜ WAITING | Action item for Ofir |
| 12 | Payroll redesign — TimeDocs file drop, per-employee rows, commission tab | ⬜ TODO | Larger redesign; depends on #11 |
| 13 | CC bank statement vs expenses reconciliation tool | ⬜ TODO | PDF/CSV parser + matching logic |
| 14 | SMS/WhatsApp appointment notifications | ⬜ TODO | Twilio or WhatsApp Business API |
| 15 | Clean test data + import real data from Access | ⬜ NEXT WEEK | Depends on Access migration (6,914 customers) |
