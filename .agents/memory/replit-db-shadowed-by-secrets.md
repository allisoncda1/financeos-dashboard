---
name: Replit built-in DB shadowed by user DATABASE_URL/PG* secrets
description: When DATABASE_URL and PG* are set as user secrets pointing to an external DB, Replit's built-in DB is shadowed and createDatabase falsely reports "alreadyExisted".
---

# Replit built-in DB shadowed by user DATABASE_URL/PG* secrets

If a user sets `DATABASE_URL` (and `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`/
`PGPORT`) as **secrets** pointing to an external database, those secrets shadow
Replit's built-in ("Helium") operational database:

- `createDatabase()` returns `alreadyExisted: true` and `checkDatabase()` reports
  `provisioned: true` — but they're just detecting the secrets, NOT a real
  provisioned Replit DB. `runtimeManaged` is empty in this state.
- `executeSql` (target `replit_database`) connects via the secret, so it lands on
  the external DB, not a fresh operational one.

**Key constraint:** the agent CANNOT delete secrets. `deleteEnvVars` only removes
plain env vars (shared scope) — it returns success on secret keys but the secrets
persist (they're global). The code_execution sandbox also can't read secret
**values** via `process.env` (isolated), so you can't copy a secret to a new name;
use `requestEnvVar` to have the user provide it.

**Fix:** ask the user to delete the shadowing secrets in the Secrets pane. Once
removed, `createDatabase()` provisions a genuine writable built-in DB and
`DATABASE_URL`/`PG*` become **runtime-managed** (role `postgres`, db `heliumdb`).

**Why it matters:** without spotting this, you'll think an operational DB exists
when every connection is actually still hitting the external DB.
