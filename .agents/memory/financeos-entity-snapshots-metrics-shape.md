---
name: FinanceOS Core entity_snapshots.metrics shape
description: The Core entity_snapshots.metrics jsonb is a nested payload, NOT the Dashboard's flat EntityMetrics — map fields, never passthrough.
---

# entity_snapshots.metrics is nested, not flat

Core (Neon, `CORE_DATABASE_URL`) writes a **nested** `metrics` jsonb into
`entity_snapshots`, unlike the Dashboard's flat `EntityMetrics` type. Never
JSON-passthrough it into a typed UI response — map field by field.

Top-level keys observed: `entity_name`, `entity_slug`, `as_of`, `pipeline` (sync
state), `alerts`/`alert_count`, `financial_summary`, `executive_kpis`,
`balance_sheet`, `cash_metrics`, `ar_ap_metrics`, `revenue_trend`,
`validation_status`, `master_data_counts`, `transaction_counts`.

**Key mapping (flat EntityMetrics ← nested Core):**
- P&L YTD (`revenue/cogs/gross_profit/opex/net_income` + `gross_margin_pct`/`net_margin_pct`)
  ← `financial_summary[ytdKey]` where `ytdKey = keys.find(k => k.startsWith("ytd"))`
  (e.g. `ytd_2026`; don't hard-code the year). `fy2025` is the prior-year sibling.
- `total_assets/total_liabilities/total_equity/cash_on_hand` ← `balance_sheet.current`.
- `open_ar/open_ap/dso_days/dpo_days/ar_overdue_pct/ap_overdue_pct` ← `ar_ap_metrics`.
- `cash_on_hand` also in `cash_metrics.cash_current` (same value).
- `pipeline_run` ← the `entity_snapshots.pipeline_run` **column** (full ISO ts), not in the jsonb.
- `entity` ← `metrics.entity_name` (or `entities.display_name`).

**Slug join:** Dashboard `EntitySlug` (`CarDealer_ai`) is the lower-cased Core
`entities.slug` (`cardealer_ai`). Join `entity_snapshots` → `entities` on
`entity_id`, filter `entities.slug = slug.toLowerCase()` AND `is_current = true`.

**jsonb numbers arrive as JS numbers** (no NUMERIC-string parsing needed). Preserve
negatives/zero — Smile_More carries negative cash/equity legitimately.

**`basis` is NOT in the metrics jsonb** — it lives in `entities.accounting_basis`
(Core says "Cash" for all). Read it from Core rather than fabricating a default;
note it conflicts with the frontend ENTITY_CONFIG per-entity basis (a separate
frontend concern, out of KPI scope).

**Why:** Core is the source of truth as of Sprint 6; its balance sheet balances
(assets = liab + equity) where the old Drive-derived numbers did not, so
Drive-vs-Neon values legitimately differ (e.g. dso_days 23.3→110.4). Prefer
reading any authoritative Core field over reproducing a prior Drive default.
