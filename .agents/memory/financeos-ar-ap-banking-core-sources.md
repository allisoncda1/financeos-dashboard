---
name: FinanceOS AR/AP/Banking Core sources
description: Which Core tables reconcile (and which don't) when deriving customer/vendor/banking presentation from Neon Core, and why AR and AP are handled asymmetrically.
---

# Deriving AR / AP / Banking from Neon Core

When migrating the customers/vendors/banking entity views off Drive CSVs onto
Neon Core, the base tables do NOT all reconcile to the Core `financial_periods`
KPIs. Verify reconciliation per-domain before choosing a source.

## AR (customers)
- `customers.balance` is Core's **authoritative per-customer AR**. Summed across
  nonzero-balance rows it reconciles to the `open_ar` KPI (e.g. T3 both 45502.18).
- Summing OPEN `invoices.balance` does **NOT** reconcile — it overstates because
  Core nets credits and excludes not-yet-due (future-dated) invoices from a
  customer's balance (T3 open invoices summed to 71669 vs open_ar 45502).
- `invoices.customer_id` → `customers.id` joins cleanly (100% match observed).
- Core publishes **no per-customer aging breakdown**; `customers`/`vendors`
  tables have no aging columns, `entity_snapshots` has only counts,
  `financial_periods` has a single `ar_overdue_pct`.
- **Approach that works:** top_customers from `customers.balance`; aging = each
  customer's full balance bucketed by their WORST open-invoice `days_overdue`
  (joined via customer_id). This keeps the aging total tied to the same
  authoritative balances behind open_ar.
- Customers with credit (negative) balances net into the Current bucket, so an
  aging bucket can be **negative**. The frontend AgingTable renders `amount <= 0`
  as "—" and skips it in the stacked bar, so it does not break.
- Residual mismatch: `open_ar` can still differ slightly from `sum(customers.balance)`
  when Core excludes non-overdue "Open"-status invoices (TopMrktr: open_ar 28440
  vs customer-balance sum 30440). Use the Core KPI for the headline; document it.

## AP (vendors) — asymmetric, a real Core gap
- `vendors.balance` is a **net** figure (can be negative for vendor credits) and
  does **NOT** reconcile to `open_ap` (T3 vendors sum -126787 vs open_ap 2518.94).
- `bills.vendor_id` does **NOT** join to `vendors.id` (0% match observed).
- The `bills` table has essentially **no open bills** (nearly all Paid), yet the
  `open_ap` KPI can be nonzero (T3 open_ap 2518.94 with zero open bills).
- **Consequence:** AP aging / top-vendor breakdowns are effectively unavailable
  from Core. Read `open_ap` + monthly `open_ap` (ap_history) from
  `financial_periods` for the headline/trend; derive aging/top_vendors from open
  bills (usually empty) and report the breakdown as unavailable. Do NOT fabricate.

## Banking
- Bank accounts = `accounts` where `account_type = 'Bank'`; the human "type"
  label comes from `account_subtype` (e.g. Checking/Savings/CashOnHand).
- `total_cash` = `financial_periods.cash_on_hand` KPI (can be negative). Do not
  recompute from account balances.
- Core has no per-account brand color, reconciliation date, or txn-level
  reconciliation; report empty and mirror the Drive `is_active` proxy.
- Account names embed the full account number; extract last-four as the LAST 4
  digits of the LONGEST digit run (not the first 4-digit match, which yields
  leading zeros), and strip digit runs to get the institution label.
