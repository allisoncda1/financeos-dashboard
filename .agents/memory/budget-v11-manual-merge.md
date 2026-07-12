---
name: Budget V1.1 manual merge adaptations
description: How the remote Budget V1.1 drop was adapted to this repo's two-DB and slug conventions; what to watch when pulling future Budget updates from origin.
---

Remote Budget code pulled from origin assumes a single database and mixed-case entity slugs. This repo differs, so future pulls of budget-related code need the same adaptations:

- **Two-DB split**: `budgets` lives in the writable ops DB (`DATABASE_URL`, via `opsDb`/`opsPool` exports in lib/db); entities/financial_periods are read from read-only Core (`CORE_DATABASE_URL`, via `db`). No cross-DB FK is possible — `budgets.entity_id` is a logical reference only.
- **Schema names**: remote schema exports (`entities`, `financialPeriods`, plain type names) differ from local (`entitiesTable`, `financialPeriodsTable`, `*Row` types). Remote db-service modules must be renamed to local exports; remote duplicate schema files (periods/qbo/snapshots/operational/sync) were deleted. Since RC-006, the preferred fix is the opposite direction: add plain-name alias exports in lib/db schema (e.g. `export const accounts = accountsTable; export type Account = AccountRow;`) so GitHub-authored service files compile unmodified and future pulls don't conflict.
- **Slug casing**: Core stores slugs lower-cased; Dashboard `EntitySlug` values are mixed-case (`CarDealer_ai`). `entityCache` lower-cases on both warm and lookup — any new Core lookup by slug must do the same or it 500s with "Entity not found in Neon".
- **Actuals periodType** in Core is `"monthly"` (not `"month"`); budgets use `"month"`/`"annual"`.
- **Git history**: remote commits could not be merged (main-agent git writes blocked); content was merged file-by-file, so origin commits are not ancestors of local history.

**Why:** upstream budget code is written against a single-DB Supabase-style setup; deploying it unmodified breaks against the read-only Core boundary.
**How to apply:** when pulling future budget/forecast commits from origin, re-check db connection imports, schema export names, slug casing, and migration SQL FKs before restarting.
