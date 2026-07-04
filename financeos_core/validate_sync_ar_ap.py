"""
financeos_core/validate_sync_ar_ap.py
--------------------------------------
Controlled validation for AR/AP transaction objects:
    Invoice, Bill, Payment, BillPayment

Scope controls:
    - One entity at a time (default: first in config)
    - Date filter: since_date (default 2026-01-01) — no historical backfill
    - Idempotency check: two runs, counts must be stable
    - No invoices of bills or payments or reports or snapshots are logged

Usage:
    python3 -m financeos_core.validate_sync_ar_ap [company_slug] [--since YYYY-MM-DD] [--no-second-run]

Security:
    - Payloads, tokens, credentials are never logged
    - Only counts and IDs are written to logs and reports
"""

import sys
import os
import argparse
import datetime
import logging
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).parent.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("validate_sync_ar_ap")

AR_AP_TYPES = ["Invoice", "Bill", "Payment", "BillPayment"]
TRANSACTION_TYPES = {"Payment", "BillPayment"}


# ── DB helpers ────────────────────────────────────────────────────────────────

def _count_table(conn, table: str, entity_id: str) -> int:
    with conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as count FROM {table} WHERE entity_id = %s", (entity_id,))
        return cur.fetchone()["count"]


def _count_transactions_by_type(conn, entity_id: str, txn_type: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) as count FROM transactions WHERE entity_id = %s AND transaction_type = %s",
            (entity_id, txn_type),
        )
        return cur.fetchone()["count"]


def _count_raw(conn, entity_id: str, object_type: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) as count FROM qbo_raw WHERE entity_id = %s AND object_type = %s",
            (entity_id, object_type),
        )
        return cur.fetchone()["count"]


def _count_sync_runs(conn, entity_id: str):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, sync_type, status, records_fetched, records_inserted, records_updated "
            "FROM sync_runs WHERE entity_id = %s ORDER BY started_at DESC LIMIT 10",
            (entity_id,),
        )
        return cur.fetchall()


def _count_sync_state(conn, entity_id: str):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT object_type, total_records, last_modified_time "
            "FROM sync_state WHERE entity_id = %s ORDER BY object_type",
            (entity_id,),
        )
        return cur.fetchall()


def _fk_miss_rate(total: int, resolved: int) -> str:
    if total == 0:
        return "n/a"
    missed = total - resolved
    pct = missed / total * 100
    return f"{missed}/{total} ({pct:.1f}% unresolved)"


# ── Company finder ────────────────────────────────────────────────────────────

def _find_company(companies: list, slug: Optional[str]) -> dict:
    if slug:
        def _slugify(name: str) -> str:
            return name.lower().replace(" ", "_").replace(".", "_").replace("-", "_")
        for c in companies:
            if c.get("slug") == slug or _slugify(c.get("name", "")) == slug:
                return c
        raise ValueError(
            f"Company '{slug}' not found. Available: {[c.get('name') for c in companies]}"
        )
    return companies[0]


# ── Core sync logic ───────────────────────────────────────────────────────────

def run_ar_ap_sync(
    cfg,
    company: dict,
    object_types: list,
    since_date: str,
    state_mgr,
    data_conn,
) -> dict:
    """
    Sync AR/AP objects for one company.
    Uses since_date as the QBO LastUpdatedTime lower bound.
    Builds FK caches in memory — no per-record DB round-trips.
    Returns counts dict.
    """
    from connectors.quickbooks import refresh_access_token
    from financeos_core.sync.extractor import QBOExtractor
    from financeos_core.sync.normalizer import (
        normalize_invoice, normalize_bill,
        normalize_payment, normalize_bill_payment,
    )
    from financeos_core.sync.loader import CoreLoader

    realm_id = company.get("realm_id")
    entity_id = state_mgr.get_entity_id_by_realm(realm_id)
    if not entity_id:
        raise RuntimeError(f"Entity not found for realm_id={realm_id}")

    company_name = company.get("name", "unknown")
    log.info(f"Entity resolved: {company_name} → DB id={entity_id[:8]}...")

    env = cfg.to_env_dict()
    token, new_rt = refresh_access_token(env, company["refresh_token"])
    if new_rt != company["refresh_token"]:
        cfg.note_rotated_token(company_name, new_rt)
    log.info("QBO token refreshed")

    sync_run_id = state_mgr.create_sync_run(
        entity_id=entity_id,
        sync_type="manual",
        object_types=object_types,
        triggered_by="validate_sync_ar_ap",
    )
    log.info(f"sync_run created: {sync_run_id[:8]}...")

    extractor = QBOExtractor(env=env, token=token, realm_id=realm_id)
    loader = CoreLoader(data_conn)

    # Build FK caches once — avoids per-record DB calls
    log.info("  Building FK caches...")
    customer_cache = loader.build_customer_id_cache(entity_id)
    vendor_cache = loader.build_vendor_id_cache(entity_id)
    account_cache = loader.build_account_id_cache(entity_id)
    log.info(
        f"  Caches ready: {len(customer_cache)} customers, "
        f"{len(vendor_cache)} vendors, {len(account_cache)} accounts"
    )

    total_fetched = total_inserted = 0
    fk_stats = {}
    errors = []

    for obj_type in object_types:
        log.info(f"  Extracting {obj_type} (TxnDate >= {since_date})...")
        try:
            # Use TxnDate filter for controlled date-range validation.
            # This fetches transactions by their actual date, not by update time.
            result = extractor.extract_entity_by_txn_date(obj_type, since_date)
            records = result.records
            n = len(records)
            log.info(f"  {obj_type}: fetched {n} records")
            total_fetched += n

            # ── Step 1: batch-upsert qbo_raw ─────────────────────────────
            raw_rows = []
            for raw in records:
                qbo_id = str(raw.get("Id", ""))
                if not qbo_id:
                    continue
                raw_rows.append({
                    "entity_id":      entity_id,
                    "object_type":    obj_type,
                    "qbo_id":         qbo_id,
                    "qbo_sync_token": str(raw.get("SyncToken", "")) or None,
                    "payload":        raw,
                    "sync_run_id":    sync_run_id,
                    "is_deleted":     not bool(raw.get("Active", True)),
                })
            loader.upsert_raw_batch(raw_rows)

            # ── Step 2: normalize with FK resolution ──────────────────────
            normalized = []
            fk_resolved = fk_total = 0

            if obj_type == "Invoice":
                for r in raw_rows:
                    raw = r["payload"]
                    cust_qbo = str((raw.get("CustomerRef") or {}).get("value", ""))
                    cust_db = customer_cache.get(cust_qbo)
                    fk_total += 1
                    if cust_db:
                        fk_resolved += 1
                    rec = normalize_invoice(entity_id, raw, customer_db_id=cust_db)
                    if rec:
                        normalized.append(rec)
                fk_stats["Invoice"] = (fk_resolved, fk_total)
                processed = loader.upsert_invoices_batch(normalized)

            elif obj_type == "Bill":
                for r in raw_rows:
                    raw = r["payload"]
                    vend_qbo = str((raw.get("VendorRef") or {}).get("value", ""))
                    vend_db = vendor_cache.get(vend_qbo)
                    fk_total += 1
                    if vend_db:
                        fk_resolved += 1
                    rec = normalize_bill(entity_id, raw, vendor_db_id=vend_db)
                    if rec:
                        normalized.append(rec)
                fk_stats["Bill"] = (fk_resolved, fk_total)
                processed = loader.upsert_bills_batch(normalized)

            elif obj_type == "Payment":
                for r in raw_rows:
                    raw = r["payload"]
                    acct_qbo = str((raw.get("DepositToAccountRef") or {}).get("value", ""))
                    acct_db = account_cache.get(acct_qbo)
                    rec = normalize_payment(entity_id, raw, account_db_id=acct_db)
                    if rec:
                        normalized.append(rec)
                processed = loader.upsert_transactions_batch(normalized)

            elif obj_type == "BillPayment":
                for r in raw_rows:
                    raw = r["payload"]
                    check_ref = (raw.get("CheckPayment") or {}).get("BankAccountRef") or {}
                    cc_ref = (raw.get("CreditCardPayment") or {}).get("CCAccountRef") or {}
                    acct_qbo = str((check_ref or cc_ref).get("value", ""))
                    acct_db = account_cache.get(acct_qbo)
                    rec = normalize_bill_payment(entity_id, raw, account_db_id=acct_db)
                    if rec:
                        normalized.append(rec)
                processed = loader.upsert_transactions_batch(normalized)

            else:
                processed = 0

            data_conn.commit()

            hwm = state_mgr._extract_high_water_mark(records, obj_type)
            state_mgr.update_sync_state(entity_id, obj_type, hwm, n)

            log.info(f"  {obj_type}: inserted={processed} committed")
            total_inserted += processed

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
            records_updated=0,
        )
    else:
        state_mgr.complete_sync_run(
            sync_run_id,
            records_fetched=total_fetched,
            records_inserted=total_inserted,
            records_updated=0,
        )

    return {
        "entity_id":  entity_id,
        "sync_run_id": sync_run_id,
        "fetched":    total_fetched,
        "inserted":   total_inserted,
        "errors":     errors,
        "fk_stats":   fk_stats,
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="AR/AP controlled validation — Invoice, Bill, Payment, BillPayment"
    )
    parser.add_argument("company_slug", nargs="?", help="Company slug (default: first in config)")
    parser.add_argument("--since", default="2026-01-01", help="QBO date lower bound (default: 2026-01-01)")
    parser.add_argument("--no-second-run", action="store_true", help="Skip idempotency check")
    args = parser.parse_args()

    from financeos_core import config as qbo_config
    from financeos_core.db.connection import get_connection
    from financeos_core.sync.state import SyncStateManager

    cfg = qbo_config.load()
    companies = cfg.to_company_dicts()
    company = _find_company(companies, args.company_slug)
    company_name = company.get("name", "unknown")
    since_date = args.since

    log.info("=" * 60)
    log.info("FinanceOS Core — AR/AP Sync Validation")
    log.info(f"Target company : {company_name}")
    log.info(f"Object types   : {', '.join(AR_AP_TYPES)}")
    log.info(f"Since date     : {since_date}")
    log.info(f"Idempotency    : {'disabled (--no-second-run)' if args.no_second_run else 'enabled (2 runs)'}")
    log.info("=" * 60)

    state_conn = get_connection()
    data_conn = get_connection()
    state_mgr = SyncStateManager(state_conn)

    entities = state_mgr.get_all_active_entities()
    if not entities:
        log.error("BLOCKED: entities table is empty.")
        sys.exit(1)
    log.info(f"Entities in DB: {[e['slug'] for e in entities]}")

    realm_id = company.get("realm_id")
    entity_id = state_mgr.get_entity_id_by_realm(realm_id)
    if not entity_id:
        log.error(f"BLOCKED: realm_id '{realm_id}' not found in entities table.")
        sys.exit(1)

    # ── Pre-run snapshot ──────────────────────────────────────────────────────
    log.info("\n── Pre-run snapshot ──────────────────────────────────────────")
    pre = {
        "invoices":     _count_table(data_conn, "invoices", entity_id),
        "bills":        _count_table(data_conn, "bills", entity_id),
        "payments":     _count_transactions_by_type(data_conn, entity_id, "Payment"),
        "bill_payments": _count_transactions_by_type(data_conn, entity_id, "BillPayment"),
        "raw_invoice":  _count_raw(data_conn, entity_id, "Invoice"),
        "raw_bill":     _count_raw(data_conn, entity_id, "Bill"),
        "raw_payment":  _count_raw(data_conn, entity_id, "Payment"),
        "raw_bp":       _count_raw(data_conn, entity_id, "BillPayment"),
    }
    for k, v in pre.items():
        log.info(f"  {k}: {v}")

    # ── Run 1 ─────────────────────────────────────────────────────────────────
    log.info("\n── Run 1 ────────────────────────────────────────────────────")
    run1 = run_ar_ap_sync(cfg, company, AR_AP_TYPES, since_date, state_mgr, data_conn)

    post1 = {
        "invoices":     _count_table(data_conn, "invoices", entity_id),
        "bills":        _count_table(data_conn, "bills", entity_id),
        "payments":     _count_transactions_by_type(data_conn, entity_id, "Payment"),
        "bill_payments": _count_transactions_by_type(data_conn, entity_id, "BillPayment"),
        "raw_invoice":  _count_raw(data_conn, entity_id, "Invoice"),
        "raw_bill":     _count_raw(data_conn, entity_id, "Bill"),
        "raw_payment":  _count_raw(data_conn, entity_id, "Payment"),
        "raw_bp":       _count_raw(data_conn, entity_id, "BillPayment"),
    }
    log.info(
        f"After run 1 — invoices={post1['invoices']} bills={post1['bills']} "
        f"payments={post1['payments']} bill_payments={post1['bill_payments']}"
    )

    # ── Run 2 (idempotency) ───────────────────────────────────────────────────
    run2 = None
    post2 = None
    if not args.no_second_run:
        log.info("\n── Run 2 (idempotency check) ────────────────────────────────")
        run2 = run_ar_ap_sync(cfg, company, AR_AP_TYPES, since_date, state_mgr, data_conn)
        post2 = {
            "invoices":     _count_table(data_conn, "invoices", entity_id),
            "bills":        _count_table(data_conn, "bills", entity_id),
            "payments":     _count_transactions_by_type(data_conn, entity_id, "Payment"),
            "bill_payments": _count_transactions_by_type(data_conn, entity_id, "BillPayment"),
            "raw_invoice":  _count_raw(data_conn, entity_id, "Invoice"),
            "raw_bill":     _count_raw(data_conn, entity_id, "Bill"),
            "raw_payment":  _count_raw(data_conn, entity_id, "Payment"),
            "raw_bp":       _count_raw(data_conn, entity_id, "BillPayment"),
        }
        log.info(
            f"After run 2 — invoices={post2['invoices']} bills={post2['bills']} "
            f"payments={post2['payments']} bill_payments={post2['bill_payments']}"
        )

    # ── Report ────────────────────────────────────────────────────────────────
    sync_runs = _count_sync_runs(data_conn, entity_id)
    sync_state_rows = _count_sync_state(data_conn, entity_id)
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    idempotent = None
    if post2 is not None:
        idempotent = all(post2[k] == post1[k] for k in post1)

    report_lines = [
        "",
        "=" * 60,
        "  FINANCEOS CORE — AR/AP VALIDATION REPORT",
        f"  {now}",
        "=" * 60,
        f"  Company      : {company_name}",
        f"  Entity ID    : {entity_id}",
        f"  Date filter  : since {since_date}",
        f"  Object types : {', '.join(AR_AP_TYPES)}",
        "",
        "── Run 1 Results ────────────────────────────────────────────",
        f"  Records fetched      : {run1['fetched']}",
        f"  Records inserted     : {run1['inserted']}",
        f"  Errors               : {len(run1['errors'])}",
    ]
    for e in run1["errors"]:
        report_lines.append(f"    - {e}")

    report_lines += [
        "",
        "── FK Resolution (Run 1) ────────────────────────────────────",
    ]
    for obj_type, (resolved, total) in run1.get("fk_stats", {}).items():
        report_lines.append(f"  {obj_type:12s}: {resolved}/{total} resolved "
                            f"({total - resolved} unresolved — stored as NULL)")

    report_lines += [
        "",
        "── Table Counts (after run 1) ───────────────────────────────",
        f"  invoices             : {post1['invoices']}  (was {pre['invoices']})",
        f"  bills                : {post1['bills']}  (was {pre['bills']})",
        f"  transactions/Payment : {post1['payments']}  (was {pre['payments']})",
        f"  transactions/BillPay : {post1['bill_payments']}  (was {pre['bill_payments']})",
        f"  qbo_raw Invoice      : {post1['raw_invoice']}  (was {pre['raw_invoice']})",
        f"  qbo_raw Bill         : {post1['raw_bill']}  (was {pre['raw_bill']})",
        f"  qbo_raw Payment      : {post1['raw_payment']}  (was {pre['raw_payment']})",
        f"  qbo_raw BillPayment  : {post1['raw_bp']}  (was {pre['raw_bp']})",
        "",
        "── sync_runs (this entity, last 10) ─────────────────────────",
    ]
    for sr in sync_runs:
        report_lines.append(
            f"  {str(sr['id'])[:8]}...  type={sr['sync_type']}  status={sr['status']}  "
            f"fetched={sr['records_fetched']}  inserted={sr['records_inserted']}"
        )

    report_lines += ["", "── sync_state (this entity) ─────────────────────────────────"]
    for ss in sync_state_rows:
        report_lines.append(
            f"  {ss['object_type']:20s}  total={ss['total_records']}  hwm={ss['last_modified_time']}"
        )

    if post2 is not None:
        report_lines += [
            "",
            "── Idempotency (Run 2) ──────────────────────────────────────",
            f"  Run 2 fetched        : {run2['fetched']}",
            f"  Run 2 inserted       : {run2['inserted']}",
            f"  Counts unchanged     : {'YES ✓' if idempotent else 'NO ✗ — counts changed!'}",
            f"  invoices after run 2 : {post2['invoices']}",
            f"  bills after run 2    : {post2['bills']}",
            f"  payments after run 2 : {post2['payments']}",
            f"  bill_pays after run 2: {post2['bill_payments']}",
        ]

    report_lines += [
        "",
        "── Security Check ───────────────────────────────────────────",
        "  Payload logging      : DISABLED",
        "  Token logging        : DISABLED",
        "  Secret logging       : DISABLED",
        "",
        "── Overall Result ───────────────────────────────────────────",
    ]

    all_errors = run1["errors"] + (run2["errors"] if run2 else [])
    tables_populated = post1["invoices"] > 0 or post1["bills"] > 0 or post1["payments"] > 0 or post1["bill_payments"] > 0

    if not all_errors and (idempotent is None or idempotent):
        status = "PASS"
        report_lines.append(f"  STATUS               : {status}")
        if not tables_populated:
            report_lines.append("  Note: No 2026 AR/AP records found in QBO (zero counts are valid).")
    else:
        status = "FAIL"
        report_lines.append(f"  STATUS               : {status}")
        for e in all_errors:
            report_lines.append(f"  Error: {e}")
        if idempotent is False:
            report_lines.append("  Reason: Counts changed on second run (not idempotent)")

    report_lines.append("=" * 60)

    report = "\n".join(report_lines)
    print(report)

    report_path = PROJECT_ROOT / "financeos_core" / "validation_report_ar_ap.txt"
    with open(report_path, "w") as f:
        f.write(report)
    log.info(f"\nReport written to: {report_path}")

    state_conn.close()
    data_conn.close()
    sys.exit(0 if status == "PASS" else 1)


if __name__ == "__main__":
    main()
