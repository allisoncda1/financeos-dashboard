"""
financeos_core/validate_sync.py
--------------------------------
Safe, limited validation of the FinanceOS Core sync engine.

Scope:
    - ONE entity only (first arg = company slug from companies.json, or first active entity)
    - Object types: Account, Customer, Vendor ONLY
    - Run twice to verify idempotency
    - Counts rows in all 5 target tables
    - Produces a written validation report
    - Logs NOTHING sensitive (no payloads, tokens, credentials)

Usage:
    python3 -m financeos_core.validate_sync
    python3 -m financeos_core.validate_sync cardealer_ai
    python3 -m financeos_core.validate_sync cardealer_ai --no-second-run

Prerequisites:
    1. DATABASE_URL must be set in .env or environment
    2. Entities must be seeded in PostgreSQL (pnpm --filter @workspace/db run seed in Replit)
"""

import sys
import json
import logging
import datetime
import argparse
from pathlib import Path
from typing import Optional

# ── Logging — safe (no payloads, no credentials) ──────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("validate_sync")

# ── Project path setup ────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent  # qbo_extract/
sys.path.insert(0, str(PROJECT_ROOT))


def _load_companies() -> list:
    """Load companies.json. Returns list of company dicts."""
    companies_path = PROJECT_ROOT / "companies.json"
    if not companies_path.exists():
        raise FileNotFoundError(f"companies.json not found at {companies_path}")
    with open(companies_path) as f:
        data = json.load(f)
    # Support both top-level list and {"companies": [...]}
    if isinstance(data, list):
        return data
    return data.get("companies", [])


def _find_company(companies: list, slug: Optional[str]) -> dict:
    """Return the target company. If slug is None, returns first active company."""
    if slug:
        for c in companies:
            if c.get("slug") == slug or c.get("name", "").lower().replace(" ", "_") == slug:
                return c
        raise ValueError(
            f"Company '{slug}' not found in companies.json. "
            f"Available: {[c.get('slug', c.get('name')) for c in companies]}"
        )
    return companies[0]


def _count_table(conn, table: str, entity_id: str) -> int:
    with conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM {table} WHERE entity_id = %s", (entity_id,))
        return cur.fetchone()["count"]


def _count_sync_runs(conn, entity_id: str) -> list:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, sync_type, status, started_at, completed_at, "
            "records_fetched, records_inserted, records_updated "
            "FROM sync_runs WHERE entity_id = %s ORDER BY started_at",
            (entity_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def _count_sync_state(conn, entity_id: str) -> list:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT object_type, total_records, last_sync_at, last_modified_time "
            "FROM sync_state WHERE entity_id = %s ORDER BY object_type",
            (entity_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def _count_raw(conn, entity_id: str, object_type: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM qbo_raw WHERE entity_id = %s AND object_type = %s",
            (entity_id, object_type),
        )
        return cur.fetchone()["count"]


def run_limited_sync(env: dict, company: dict, object_types: list, state_mgr, data_conn) -> dict:
    """
    Run the sync engine for one company, limited to the given object types.
    Returns a summary dict with counts.
    """
    from connectors.quickbooks import refresh_access_token, save_rotated_tokens
    from financeos_core.sync.extractor import QBOExtractor
    from financeos_core.sync.normalizer import normalize_account, normalize_customer, normalize_vendor
    from financeos_core.sync.loader import CoreLoader

    realm_id = company.get("realm_id") or company.get("realmId") or company.get("realm")
    if not realm_id:
        raise ValueError(f"No realm_id found for company: {list(company.keys())}")

    entity_id = state_mgr.get_entity_id_by_realm(realm_id)
    if not entity_id:
        raise RuntimeError(
            f"Entity not found in DB for realm_id={realm_id}. "
            f"Run 'pnpm --filter @workspace/db run seed' in Replit first."
        )

    company_name = company.get("name", "unknown")
    log.info(f"Entity resolved: {company_name} → DB id={entity_id[:8]}...")

    # Refresh QBO token (same pattern as runner.py)
    token, new_rt = refresh_access_token(env, company["refresh_token"])
    save_rotated_tokens({company_name: new_rt})
    log.info("QBO token refreshed")

    normalizers = {
        "Account": normalize_account,
        "Customer": normalize_customer,
        "Vendor": normalize_vendor,
    }

    sync_run_id = state_mgr.create_sync_run(
        entity_id=entity_id,
        sync_type="manual",
        object_types=object_types,
        triggered_by="validate_sync",
    )
    log.info(f"sync_run created: {sync_run_id[:8]}...")

    extractor = QBOExtractor(env=env, token=token, realm_id=realm_id)
    loader = CoreLoader(data_conn)

    total_fetched = 0
    total_inserted = 0
    total_updated = 0
    errors = []

    for obj_type in object_types:
        log.info(f"  Extracting {obj_type}...")
        try:
            result = extractor.extract_entity(obj_type)
            records = result.records
            n = len(records)
            log.info(f"  {obj_type}: fetched {n} records")
            total_fetched += n

            inserted = 0
            updated = 0
            for raw in records:
                qbo_id = str(raw.get("Id", ""))
                sync_token = str(raw.get("SyncToken", "")) or None

                is_new = loader.upsert_raw(
                    entity_id=entity_id,
                    object_type=obj_type,
                    qbo_id=qbo_id,
                    qbo_sync_token=sync_token,
                    payload=raw,
                    sync_run_id=sync_run_id,
                )
                if is_new:
                    inserted += 1
                else:
                    updated += 1

                normalized = normalizers[obj_type](entity_id, raw)
                if obj_type == "Account":
                    loader.upsert_account(normalized)
                elif obj_type == "Customer":
                    loader.upsert_customer(normalized)
                elif obj_type == "Vendor":
                    loader.upsert_vendor(normalized)

            data_conn.commit()

            hwm = state_mgr._extract_high_water_mark(records, obj_type)
            state_mgr.update_sync_state(entity_id, obj_type, hwm, n)

            log.info(f"  {obj_type}: inserted={inserted} updated={updated} committed")
            total_inserted += inserted
            total_updated += updated

        except Exception as exc:
            log.error(f"  {obj_type} FAILED: {type(exc).__name__}: {exc}")
            errors.append(f"{obj_type}: {type(exc).__name__}: {exc}")
            try:
                data_conn.rollback()
            except Exception:
                pass

    if errors:
        state_mgr.partial_sync_run(
            sync_run_id,
            error_message="; ".join(errors),
            records_fetched=total_fetched,
            records_inserted=total_inserted,
            records_updated=total_updated,
        )
    else:
        state_mgr.complete_sync_run(
            sync_run_id,
            records_fetched=total_fetched,
            records_inserted=total_inserted,
            records_updated=total_updated,
        )

    return {
        "entity_id": entity_id,
        "sync_run_id": sync_run_id,
        "fetched": total_fetched,
        "inserted": total_inserted,
        "updated": total_updated,
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser(description="Safe sync validation — Account/Customer/Vendor only")
    parser.add_argument("company_slug", nargs="?", help="Company slug (default: first in companies.json)")
    parser.add_argument("--no-second-run", action="store_true", help="Skip idempotency check")
    args = parser.parse_args()

    from connectors.quickbooks import load_companies as qbo_load_companies
    companies = qbo_load_companies()
    company = _find_company(companies, args.company_slug)
    company_name = company.get("slug") or company.get("name") or "unknown"

    log.info("=" * 60)
    log.info(f"FinanceOS Core — Safe Sync Validation")
    log.info(f"Target company : {company_name}")
    log.info(f"Object types   : Account, Customer, Vendor")
    log.info(f"Idempotency    : {'disabled (--no-second-run)' if args.no_second_run else 'enabled (2 runs)'}")
    log.info("=" * 60)

    # ── Connect ───────────────────────────────────────────────────────────────
    from connectors.quickbooks import load_env
    from financeos_core.db.connection import get_connection
    from financeos_core.sync.state import SyncStateManager

    env = load_env()
    state_conn = get_connection()
    data_conn = get_connection()
    state_mgr = SyncStateManager(state_conn)

    # ── Prerequisite check: entities seeded? ──────────────────────────────────
    log.info("Checking entities table...")
    entities = state_mgr.get_all_active_entities()
    if not entities:
        log.error("BLOCKED: entities table is empty. Run 'pnpm --filter @workspace/db run seed' in Replit first.")
        sys.exit(1)
    log.info(f"Entities in DB: {[e['slug'] for e in entities]}")

    realm_id = company.get("realm_id") or company.get("realmId") or company.get("realm")
    entity_id = state_mgr.get_entity_id_by_realm(realm_id) if realm_id else None
    if not entity_id:
        log.error(
            f"BLOCKED: realm_id '{realm_id}' not found in entities table. "
            f"Seed the entities or check that the QBO realm IDs match companies.json."
        )
        sys.exit(1)

    object_types = ["Account", "Customer", "Vendor"]

    # ── Snapshot before run 1 ─────────────────────────────────────────────────
    log.info("\n── Pre-run snapshot ──────────────────────────────────────────")
    pre_accounts = _count_table(data_conn, "accounts", entity_id)
    pre_customers = _count_table(data_conn, "customers", entity_id)
    pre_vendors = _count_table(data_conn, "vendors", entity_id)
    pre_raw_account = _count_raw(data_conn, entity_id, "Account")
    pre_raw_customer = _count_raw(data_conn, entity_id, "Customer")
    pre_raw_vendor = _count_raw(data_conn, entity_id, "Vendor")
    log.info(f"  accounts:  {pre_accounts}")
    log.info(f"  customers: {pre_customers}")
    log.info(f"  vendors:   {pre_vendors}")
    log.info(f"  qbo_raw Account:   {pre_raw_account}")
    log.info(f"  qbo_raw Customer:  {pre_raw_customer}")
    log.info(f"  qbo_raw Vendor:    {pre_raw_vendor}")

    # ── Run 1 ─────────────────────────────────────────────────────────────────
    log.info("\n── Run 1 ────────────────────────────────────────────────────")
    run1 = run_limited_sync(env, company, object_types, state_mgr, data_conn)

    post1_accounts = _count_table(data_conn, "accounts", entity_id)
    post1_customers = _count_table(data_conn, "customers", entity_id)
    post1_vendors = _count_table(data_conn, "vendors", entity_id)
    post1_raw_account = _count_raw(data_conn, entity_id, "Account")
    post1_raw_customer = _count_raw(data_conn, entity_id, "Customer")
    post1_raw_vendor = _count_raw(data_conn, entity_id, "Vendor")
    log.info(f"After run 1 — accounts={post1_accounts} customers={post1_customers} vendors={post1_vendors}")

    # ── Run 2 (idempotency check) ─────────────────────────────────────────────
    run2 = None
    post2_accounts = post2_customers = post2_vendors = None
    post2_raw_account = post2_raw_customer = post2_raw_vendor = None

    if not args.no_second_run:
        log.info("\n── Run 2 (idempotency check) ────────────────────────────────")
        run2 = run_limited_sync(env, company, object_types, state_mgr, data_conn)

        post2_accounts = _count_table(data_conn, "accounts", entity_id)
        post2_customers = _count_table(data_conn, "customers", entity_id)
        post2_vendors = _count_table(data_conn, "vendors", entity_id)
        post2_raw_account = _count_raw(data_conn, entity_id, "Account")
        post2_raw_customer = _count_raw(data_conn, entity_id, "Customer")
        post2_raw_vendor = _count_raw(data_conn, entity_id, "Vendor")
        log.info(f"After run 2 — accounts={post2_accounts} customers={post2_customers} vendors={post2_vendors}")

    # ── Query sync_runs and sync_state ────────────────────────────────────────
    sync_runs = _count_sync_runs(data_conn, entity_id)
    sync_state_rows = _count_sync_state(data_conn, entity_id)

    # ── Validation report ─────────────────────────────────────────────────────
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    idempotent = None
    if run2 is not None:
        idempotent = (
            post2_accounts == post1_accounts
            and post2_customers == post1_customers
            and post2_vendors == post1_vendors
            and post2_raw_account == post1_raw_account
            and post2_raw_customer == post1_raw_customer
            and post2_raw_vendor == post1_raw_vendor
        )

    report_lines = [
        "",
        "=" * 60,
        "  FINANCEOS CORE SYNC — VALIDATION REPORT",
        f"  {now}",
        "=" * 60,
        f"  Company      : {company_name}",
        f"  Entity ID    : {entity_id}",
        f"  Object types : Account, Customer, Vendor",
        "",
        "── Prerequisites ────────────────────────────────────────────",
        f"  Entities seeded      : YES ({len(entities)} active entities)",
        f"  DATABASE_URL         : CONNECTED",
        "",
        "── Run 1 Results ────────────────────────────────────────────",
        f"  Records fetched      : {run1['fetched']}",
        f"  Records inserted     : {run1['inserted']}",
        f"  Records updated      : {run1['updated']}",
        f"  Errors               : {len(run1['errors'])}",
    ]
    if run1["errors"]:
        for e in run1["errors"]:
            report_lines.append(f"    - {e}")

    report_lines += [
        "",
        "── Table Counts (after run 1) ───────────────────────────────",
        f"  accounts             : {post1_accounts}  (was {pre_accounts})",
        f"  customers            : {post1_customers}  (was {pre_customers})",
        f"  vendors              : {post1_vendors}  (was {pre_vendors})",
        f"  qbo_raw Account      : {post1_raw_account}  (was {pre_raw_account})",
        f"  qbo_raw Customer     : {post1_raw_customer}  (was {pre_raw_customer})",
        f"  qbo_raw Vendor       : {post1_raw_vendor}  (was {pre_raw_vendor})",
        "",
        "── sync_runs (this entity) ──────────────────────────────────",
    ]
    for sr in sync_runs:
        report_lines.append(
            f"  {str(sr['id'])[:8]}...  type={sr['sync_type']}  status={sr['status']}  "
            f"fetched={sr['records_fetched']}  inserted={sr['records_inserted']}  updated={sr['records_updated']}"
        )

    report_lines += [
        "",
        "── sync_state (this entity) ─────────────────────────────────",
    ]
    for ss in sync_state_rows:
        report_lines.append(
            f"  {ss['object_type']:20s}  total={ss['total_records']}  hwm={ss['last_modified_time']}"
        )

    if run2 is not None:
        report_lines += [
            "",
            "── Idempotency (Run 2) ──────────────────────────────────────",
            f"  Run 2 fetched        : {run2['fetched']}",
            f"  Run 2 inserted       : {run2['inserted']}",
            f"  Run 2 updated        : {run2['updated']}",
            f"  Counts unchanged     : {'YES ✓' if idempotent else 'NO ✗ — row counts changed between runs!'}",
            f"  accounts after run 2 : {post2_accounts}",
            f"  customers after run 2: {post2_customers}",
            f"  vendors after run 2  : {post2_vendors}",
        ]

    report_lines += [
        "",
        "── Security Check ───────────────────────────────────────────",
        "  Payload logging      : DISABLED (payloads written to DB only)",
        "  Token logging        : DISABLED (no credential values in logs)",
        "  Secret logging       : DISABLED (env vars not printed)",
        "",
        "── Overall Result ───────────────────────────────────────────",
    ]

    all_errors = run1["errors"] + (run2["errors"] if run2 else [])
    tables_populated = post1_accounts > 0 or post1_customers > 0 or post1_vendors > 0
    sync_runs_created = len([sr for sr in sync_runs if str(sr.get("sync_run_id", "")) or True]) > 0

    if not all_errors and tables_populated and (idempotent is None or idempotent):
        status = "PASS"
        report_lines.append(f"  STATUS               : {status}")
        report_lines.append("  Ready for Phase 3 dashboard integration.")
    else:
        status = "FAIL"
        report_lines.append(f"  STATUS               : {status}")
        if all_errors:
            report_lines.append(f"  Reason: {len(all_errors)} error(s) during sync")
        if not tables_populated:
            report_lines.append("  Reason: No rows written to normalized tables")
        if idempotent is False:
            report_lines.append("  Reason: Row counts changed on second run (not idempotent)")

    report_lines.append("=" * 60)

    report = "\n".join(report_lines)
    print(report)

    # Write report to file
    report_path = PROJECT_ROOT / "financeos_core" / "validation_report.txt"
    with open(report_path, "w") as f:
        f.write(report)
    log.info(f"\nReport written to: {report_path}")

    state_conn.close()
    data_conn.close()

    sys.exit(0 if status == "PASS" else 1)


if __name__ == "__main__":
    main()
