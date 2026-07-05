---
name: Neon restricted dashboard role
description: The FinanceOS Dashboard connects to Core's Neon DB with a read-scoped role that cannot CREATE tables; runtime tables must be handled defensively.
---

# Neon restricted dashboard role

When `DATABASE_URL` points at FinanceOS Core's Neon database, the Dashboard
connects as role **`financeos_dashboard`**, which has `USAGE` but **not
`CREATE`** on schema `public`. Any DDL the Dashboard runs (e.g. creating its own
`session` or `metric_snapshots` runtime tables) fails with Postgres SQLSTATE
**`42501` "permission denied for schema public"**.

**Why:** Core owns the schema and only grants the Dashboard a read-scoped role.
Startup code that unconditionally `CREATE TABLE IF NOT EXISTS ...` will crash the
process, and lazy table creation (metric_snapshots) will throw on first use.

**How to apply:**
- Treat table creation against Neon as may-fail. Catch `err.code === "42501"`
  specifically and degrade gracefully; re-throw other errors so genuine
  connectivity/config failures still fail loudly.
- Session storage falls back to express-session's in-memory store when the
  `session` table can't be created (sessions then don't persist across restarts
  or scale across instances) — acceptable for dev, but a real deployment needs
  Core to provision `session` (and `metric_snapshots`) with proper grants, or a
  separate session DB. This is a known Sprint 6 blocker.
- These runtime tables (`session`, `metric_snapshots`) are NOT present in Neon;
  they were previously created at runtime against the old built-in Postgres.
