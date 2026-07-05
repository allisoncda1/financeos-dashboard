---
name: FinanceOS Company Health Score single source
description: Where the entity health score is computed and the rule that the UI must never recompute a headline score
---

# Company Health Score — single source of truth

The entity health score is computed **once, server-side** in `api-server/src/lib/health.ts`
(`computeEntityHealthScore` + `entityHealthLabel` + `withHealth`). `rules/registry.ts`
imports the same `computeEntityHealthScore` so rules and the served score never drift.

Injection happens at the data boundary, not per-surface:
- `dataSource.ts#getEntityMetrics` wraps all three producer paths (Neon / Drive / mock) with `withHealth`.
- `snapshotStore.ts#getMetricSnapshots` re-derives health on read so old snapshots (archived before health existed) also carry it — history reads `s.metrics.health_score` directly.

**Rule:** the frontend renders `metrics.health_score` / `metrics.health_label` verbatim on every
headline surface (Sidebar, Portfolio EntityCard, entity dashboard, Integrity, Performance, History,
PortfolioKpiStrip). It must **never** call a client formula for a headline value. `computeCompanyHealth`
(`financeos/src/lib/healthScore.ts`) is kept ONLY for the CompanyHealth category-bar breakdown detail —
the arc/number/label come from the passed server score.

**Why:** before this, surfaces disagreed — the Sidebar used static mock data + the AP-inclusive
`briefing.computeHealthScore`, while EntityCard/dashboard used live data + the same client formula, so
one entity showed different scores in different places.

**Type asymmetry (intentional):** backend `EntityMetrics.health_score/health_label` are OPTIONAL (raw
producers build metrics before injection); frontend `EntityMetrics` makes them REQUIRED (post-injection
contract the UI relies on).

**Known discrepancy:** the authoritative server formula has **no AP-overdue term** (DSO + AR-overdue +
net-margin only). `briefing.computeHealthScore` (still used ONLY to populate offline mock in
`lib/mock.ts#withHealth`) DOES include an AP term. Acceptable because mock is offline-only and every
surface still reads the one injected field. If unifying later, drop the AP branch from briefing to match.
