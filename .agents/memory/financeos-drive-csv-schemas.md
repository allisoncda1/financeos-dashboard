---
name: FinanceOS Drive CSV schemas
description: Real Google Drive CSV export headers for FinanceOS entities differ from the simplified schema assumed in specs; use real headers, not assumed names.
---

The per-entity CSVs synced into Google Drive for FinanceOS are QuickBooks-style exports, not the simplified/normalized schemas that specs or prior plans may assume. Column names and shapes differ meaningfully from what a spec author guesses.

**Why:** A prior implementation pass wrote transformers against assumed column names (e.g. `opex`) and they were wrong — the real files use different names and structures (e.g. `operating_expenses`), and some "totals" don't exist as rows at all and must be computed by summing line items.

**How to apply:** Before writing or modifying any CSV transformer for FinanceOS, inspect the actual Drive file headers first (e.g. via a short read-only Node script using the api-server's own `googleapis` client and Drive folder/env config) rather than trusting a spec's assumed column names. Known real-world shapes as of this writing:
- `pnl_current.csv`: uses `operating_expenses`, not `opex`.
- `balance_sheet_current.csv`: line-item format (`account_name`/`account_type`/`account_subtype`/`section_path`/`amount`) with no explicit "total" rows — totals must be computed by summing.
- `ar_aging.csv` / `ap_aging.csv`: invoice/bill-level records, grouped into buckets via an `aging_bucket` field.
- `customers_enriched.csv` / `vendors_enriched.csv`: only balance + contact info; derived fields (status, DSO) must be computed from aging/overdue data.
- `accounts_enriched.csv`: full chart of accounts; bank accounts identified by `account_type === "Bank"`, with institution/last_four parsed out of `account_name`.
- `bill_lines.csv`: used as a proxy for banking transactions (reconciled ⇢ `bill_balance === 0`).
