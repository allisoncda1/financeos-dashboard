---
name: FinanceOS AR/AP/Banking Core sources
description: Which Neon Core tables reconcile to the financial_periods KPIs when deriving customer/vendor/banking views, and why AR and AP must be handled asymmetrically.
---

# Deriving AR / AP / Banking from Neon Core

The Core base tables do NOT all reconcile to the `financial_periods` KPIs.
Verify reconciliation per-domain before choosing a source; never assume the base
rows sum to a published KPI.

## AR (customers)
- **`customers.balance` is authoritative** and reconciles to the `open_ar` KPI.
  Summing OPEN `invoices.balance` does NOT — Core nets credits and excludes
  not-yet-due invoices from a customer's balance, so invoice sums overstate AR.
- Core publishes **no per-customer aging breakdown** (customers/vendors tables
  have no aging columns; entity_snapshots has only counts).
- Working approach: top-customer list from `customers.balance`; aging = each
  customer's full balance bucketed by their worst open-invoice `days_overdue`
  (invoices→customers join is reliable). This keeps aging tied to the same
  authoritative balances behind `open_ar`.
- Credit (negative) balances net into the Current bucket, so a bucket can be
  **negative**; the frontend AgingTable renders `amount<=0` as "—" safely.
- `open_ar` can still differ slightly from `sum(customers.balance)` when Core
  excludes non-overdue "Open"-status invoices — use the Core KPI for the
  headline and document the gap; do not reconcile by recomputing.

## AP (vendors) — a genuine Core gap, handled asymmetrically
- `vendors.balance` is a net figure (can be negative) that does NOT reconcile to
  `open_ap`; `bills.vendor_id` does not join `vendors.id`; and `bills` is often
  effectively empty (nearly all Paid) even when `open_ap` is nonzero.
- Consequence: read `open_ap` + monthly `open_ap` from `financial_periods` for
  the headline/trend; derive aging/top-vendors from open bills (usually empty)
  and report the breakdown as unavailable rather than fabricating it.

## Banking
- Bank accounts = `accounts` where `account_type='Bank'`; the display "type"
  label is `account_subtype`. `total_cash` = `cash_on_hand` KPI (can be
  negative) — do not recompute from account balances.
- Core has no per-account color, reconciliation date, or txn-level
  reconciliation; report empty / mirror the `is_active` proxy.
- Account names embed the full account number: derive last-four as the LAST 4
  digits of the LONGEST digit run (a naive first-4 match yields leading zeros).

## KPI discipline (applies to all three)
Headline KPIs (`open_ar`, `open_ap`, `total_cash`) and trend series must be read
straight from `financial_periods`. If the entity has no YTD KPI row, THROW so the
caller falls through to Drive — never recompute a KPI from derived lists.
