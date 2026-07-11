---
name: FinanceOS two-database boundary (Core vs operational)
description: FinanceOS Dashboard uses two separate Postgres databases — read-only Neon Core for financial data, and a writable Replit operational DB for sessions/metric_snapshots.
---

# FinanceOS two-database boundary

The Dashboard connects to **two** separate Postgres databases. Keep them separate:

- **`CORE_DATABASE_URL`** — read-only Neon (FinanceOS Core). Holds financial
  read-models: `portfolio_snapshots`, `entity_snapshots`, `financial_periods`,
  `validation_results`, `sync_runs` (+ full Core schema). The Dashboard connects
  as role **`financeos_dashboard`** (db `neondb`), which has `USAGE` but **not
  `CREATE`** on `public` — any DDL fails with SQLSTATE `42501`. `lib/db`
  (`@workspace/db`, used by `neonSource.ts`) points here. Financial reads only.
- **`DATABASE_URL`** — writable Replit built-in operational DB (role `postgres`,
  db `heliumdb`). Holds Dashboard operational tables: `session` (auth) and
  `metric_snapshots`. `app.ts` (sessionPool) and `snapshotStore.ts` point here.

**Why:** Core is owned upstream and grants the Dashboard only a read-scoped role,
so the Dashboard must never write to Core and no session/UI tables may live there.
Sessions need a writable DB; the operational DB provides it.

**How to apply:**
- Financial-read code → `CORE_DATABASE_URL`. Session/UI/operational code →
  `DATABASE_URL`. Never create session/metric tables against Core.
- There is NO in-memory session fallback. Session-table DDL runs against the
  writable operational DB and must succeed; failure should crash startup loudly.
- `runtimeTables.ts` in `lib/db` mirrors `session`/`metric_snapshots` only so
  `drizzle-kit push` won't drop them; the runtime creates them via raw SQL. Note
  `lib/db`'s drizzle schema mixes Core read-models + these operational tables, so
  `drizzle-kit push` against a single DB is semantically split — not run at
  runtime, but a latent cleanup item.
