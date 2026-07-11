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

# "db" is now a first-class ApiSource (preserved, not coerced)

Frontend `ApiSource`/`DataSourceState` now include `"db"`; `api.ts`
`normalizeSource` PRESERVES `"db"` (only truly-unknown values fall back to
`"live"`). `db` is treated as healthy everywhere: `SEVERITY.db = 0`, and
`DataSourceBanner` early-returns for `db` (same "no warning" as `live`).

**Why:** the entity-dashboard trust cleanup needed to distinguish real Core DB
reads from the nondeterministic `/api/model` live/cache source, so the dashboard
SourcePill can honestly show "Live DB". This reversed the earlier decision to
coerce `db`→`live`.

**How to apply:** when adding a `Record<DataSourceState,…>` or a source-aware
prop union, remember `db` is a valid member — omitting it is a type error.
