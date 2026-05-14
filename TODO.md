## Phase 2 — Roles & In-Salon Workflow

[ ] Create `sales` role — sales floor staff can view wig inventory and log a sale (prints receipt with DaySmart serial, fills in wig details). This eliminates the manual paper receipt step.

[ ] Create `front_desk` role — front desk can review daily sales entries and generate/confirm the daily report. This replaces the Microsoft Access → envelope → Tzipora pipeline.

[ ] When both roles exist, wire up a digital document handoff: sales entry → front desk review → auto-queued in Tzipora's daily entry flow.

---

## Business Logic — Distributor Payment Tracking

[ ] The owner pays the wig distributor ONLY after a wig is fully paid by the client. Currently the app tracks this via `wig_orders.status = paid_in_full` and the Wig Orders "Completed" tab — but there is no explicit AP (accounts payable) flag or notification.

[ ] Future: when a wig flips to `paid_in_full`, trigger a "distributor payment due" event so Avi can see which distributors need to be paid and for which wigs.

---

## DaySmart PDF Automation

[ ] Parse DaySmart daily PDF → auto-fill Tzipora's Activity tab (wig serial, client, transaction details). This is the single highest-leverage automation in the entire system.
