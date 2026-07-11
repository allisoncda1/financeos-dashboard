---
name: FinanceOS financial_periods coverage & shape
description: What Core's financial_periods table does/doesn't carry, and how it maps to the Dashboard's financials/history API shapes.
---

Core's `financial_periods` (read via CORE_DATABASE_URL) is the source of truth for
per-entity financial history. `period_type` ∈ {monthly, quarterly, annual, ytd}.
Numeric columns surface as **strings** via Drizzle (e.g. "268355.00") — parse
before use. `period_start`/`period_end` are `date` columns (string "YYYY-MM-DD");
month label = `period_start.slice(0,7)` ("2025-01"), matching the Drive/mock
`monthly_pl` shape.

**Coverage seen:** monthly spans prior + current fiscal year; exactly one `ytd`
row per entity (current year, carries the full balance-sheet totals + as-of date);
`annual` rows exist only for completed prior years. Current fiscal year = the
`ytd` row's year (don't hardcode). "Prior years" for history = `annual` rows with
year < current year.

**Never recompute:** read `ytd_summary` from the `ytd` row and prior-year
summaries from the `annual` row directly — do NOT re-sum monthly rows.

**Fields NOT in financial_periods (map to 0/null, don't fabricate):**
- Balance-sheet **line-item breakdown** (prepaid, equipment_net, accrued,
  deferred_revenue, notes_payable, paid_in_capital, retained_earnings). Only
  TOTALS + cash/AR/AP exist, so sub-lines are 0; totals read from Core.
- **Cash-flow statement** — not modeled, so `FinancialsData.cash_flow` is null.

**Quarterly is intentionally NOT exposed by the API.** The `FinancialsData` /
`EntityHistoryData` TypeScript interfaces have no quarterly field and the Drive
path never surfaced one. `quarterly` rows exist in Core but adding a field would
break "identical interfaces / no frontend changes". Document as a deliberate gap;
surfacing it is a future product+frontend decision.

**One query per endpoint / no N+1:** fetch ALL of an entity's `financial_periods`
rows in a single query, then partition by `period_type` in memory.
