---
name: FinanceOS alerts come from Core alerts table
description: Dashboard reads business alerts from Core Neon `alerts`, not the RulesEngine; scope/category mapping and the db→live source-coercion decision.
---

# Dashboard alerts are READ from Core, not calculated

The Dashboard's `/api/alerts`, `/api/alerts/:entity`, `/api/alerts/portfolio`
endpoints read from FinanceOS Core's Neon `alerts` table (CORE_DATABASE_URL),
projected into the frontend `Alert` shape. The Dashboard does NOT calculate
these alerts.

**Why:** Core is the system of record for business alerts; recalculating in the
Dashboard would drift from Core and duplicate rule logic.

**How to apply:**
- Core `alerts.entity_id` NULL = portfolio scope; non-null = entity scope
  (join `entities` for slug + display_name). `display_name` matches the
  frontend ENTITY_CONFIG names exactly, so name→slug resolution works.
- `alert_type` → frontend AlertCategory needs an explicit map plus a
  prefix/`validation` fallback so a NEW Core alert_type never breaks the typed
  UI. Keep the map in sync as Core adds rule types.
- Core severity is a subset (critical|high|medium); coerce unknown → medium,
  unknown status → open. Filter out `resolved` on read.
- Core has NO recommendation column; the Operations Inbox action label is
  derived per-category presentation text, not a recalculation.

# RulesEngine is still live (Sprint 11 gap)

The in-repo RulesEngine (`rules/*`) still CALCULATES alerts, but only for
AI briefing/context, reports/builder, the validation pipeline, and the
`/api/rules` static-metadata endpoint. Those were intentionally left out of the
alerts-migration scope — migrating them to Core is future work.

# normalizeSource intentionally coerces "db" → "live"

Frontend `ApiSource` is `live|cache|mock`; `api.ts` `normalizeSource` coerces
`"db"` (and any unknown) to `"live"`. This is deliberate, NOT a bug: a Core DB
read is live, current data, so the DataSourceBanner/Badge should show no
degraded-source warning.

**Why:** Adding `"db"` to the union would ripple through the `SEVERITY`
`Record<DataSourceState,…>` and `DataSourceBadge` prop union app-wide (a
frontend badge redesign), for no UX benefit — db-sourced data deserves the same
"no warning" treatment as live.
