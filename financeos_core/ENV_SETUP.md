# FinanceOS Core — Environment Setup

The sync engine reads ALL credentials from the existing `.env` file in the project root.
No new credential files. No new secrets management. No changes to the existing QBO setup.

## New Variable Required

Add the following to `.env` (the same file that holds QBO credentials):

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Get this value from Replit Secrets → `DATABASE_URL` (the value is already set in Replit
for the existing Node.js backend). Copy the same value into the local `.env` for local
development runs.

## Running the Sync Engine

```bash
# From the qbo_extract/ project root:

# Install the new dependency (once):
pip3 install -r financeos_core/requirements_core.txt

# Full backfill — fetches all historical QBO data
python3 -m financeos_core.sync.runner full_backfill

# Incremental — fetches only records changed since last sync
python3 -m financeos_core.sync.runner incremental

# Manual — same as full_backfill, for on-demand use
python3 -m financeos_core.sync.runner manual
```

## What Happens

1. Connects to QBO using existing `.env` + `companies.json` credentials
2. For each of the 4 entities (sequential):
   - Creates a `sync_run` record in the database
   - Extracts 12 object types + 4 report types from QBO
   - Writes raw payloads to `qbo_raw`
   - Writes normalized records to `accounts`, `customers`, `vendors`, `invoices`, `bills`, `transactions`
   - Updates `sync_state` high-water marks
   - Marks `sync_run` complete or partial
3. Logs a summary

## What Is NOT Affected

- `main.py` — the existing pipeline is completely unchanged
- `data/raw/*.csv`, `data/processed/*.csv` — existing exports are untouched
- `data/exports/` — existing Excel/PDF reports are untouched
- Google Drive uploads — unchanged
- The FinanceOS dashboard — still reads from Google Drive (Phase 2 is DB population only)

## QBO Realm IDs and DB Seed

Before the first sync, ensure the 4 entities are seeded in the `entities` table.
The sync engine looks up each company by `qbo_realm_id`. If a realm is not found,
that entity is skipped with a warning.

Seed command (run in the `financeos-dashboard` repo):
```bash
pnpm --filter @workspace/db run seed
```

Set these environment variables before seeding (or they will use placeholder values):
```
QBO_REALM_CARDEALER_AI=<realm_id from companies.json>
QBO_REALM_T3_MARKETING=<realm_id from companies.json>
QBO_REALM_TOPMRKTR=<realm_id from companies.json>
QBO_REALM_SMILE_MORE=<realm_id from companies.json>
```
