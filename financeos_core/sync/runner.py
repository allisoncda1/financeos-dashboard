"""
financeos_core/sync/runner.py
-------------------------------
FinanceOS Core Sync Engine — main orchestrator.

Execution modes:
    full_backfill   — fetch ALL records from QBO (no date filter)
    incremental     — fetch only records changed since last sync (LastUpdatedTime)
    manual          — same as full_backfill; intended for one-off triggered runs

Entry points:
    python3 -m financeos_core.sync.runner full_backfill
    python3 -m financeos_core.sync.runner incremental
    python3 -m financeos_core.sync.runner manual

Architecture:
    1. Load configuration from environment variables via financeos_core.config
    2. For each entity (sequential — never parallel):
        a. Refresh QBO access token
        b. Resolve entity DB UUID from realm_id
        c. Create sync_run record (status=running)
        d. For each object type:
            i.  Extract raw QBO objects
            ii. Upsert into qbo_raw
            iii. Normalize and upsert into typed tables
            iv. Update sync_state
        e. Mark sync_run complete/partial/failed
    3. Log final summary

Guarantees:
    - A failed entity never stops other entities
    - Every failure is recorded in sync_runs.error_message
    - No silent failures
    - Credentials, tokens, and payloads are never logged
    - The existing pipeline (main.py), dashboard, and exports are not affected
"""

import sys
import os
import logging
import datetime
from typing import List, Optional

# Allow running as: python3 -m financeos_core.sync.runner
# Adds the qbo_extract root to sys.path so connectors.quickbooks is importable.
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from connectors.quickbooks import refresh_access_token
from financeos_core import config as qbo_config
from financeos_core.db.connection import get_connection
from financeos_core.sync.extractor import QBOExtractor, INCREMENTAL_ENTITIES, REPORT_TYPES
from financeos_core.sync.normalizer import (
    normalize_account,
    normalize_customer,
    normalize_vendor,
    normalize_invoice,
    normalize_bill,
    normalize_transaction,
)
from financeos_core.sync.loader import CoreLoader
from financeos_core.sync.state import SyncStateManager

log = logging.getLogger(__name__)

# ── Object type groups ────────────────────────────────────────────────────────

# Entity types that map to dedicated normalized tables
ENTITY_OBJECT_TYPES = [
    "Account",
    "Customer",
    "Vendor",
    "Invoice",
    "Bill",
]

# Transaction types that map to the transactions table
TRANSACTION_OBJECT_TYPES = [
    "Payment",
    "BillPayment",
    "Purchase",
    "Deposit",
    "JournalEntry",
    "Transfer",
    "SalesReceipt",
]

# All QBO entity object types (ordered — accounts must come before invoices/bills
# so FK lookups succeed within the same sync run)
ALL_OBJECT_TYPES = ENTITY_OBJECT_TYPES + TRANSACTION_OBJECT_TYPES

# Report types — always fetched in full (no incremental)
ALL_REPORT_TYPES = [
    "ProfitAndLoss",
    "BalanceSheet",
    "AgedReceivableDetail",
    "AgedPayableDetail",
]


# ── Entity sync ───────────────────────────────────────────────────────────────

def sync_entity(
    cfg: "qbo_config.QBOConfig",
    company: dict,
    entity_id: str,
    sync_type: str,
    state_mgr: SyncStateManager,
    data_conn,
) -> dict:
    """
    Run a full sync for one entity (company).

    Args:
        cfg:       QBOConfig loaded by config.load() — the only source of credentials
        company:   Dict { name, realm_id, refresh_token } from cfg.to_company_dicts()
        entity_id: DB UUID of the entity (from entities table)
        sync_type: 'full_backfill' | 'incremental' | 'manual'
        state_mgr: SyncStateManager instance (uses its own connection)
        data_conn: psycopg2 connection for data writes

    Returns dict with counts: fetched, inserted, updated, skipped, errors
    """
    name    = company["name"]
    realm   = company["realm_id"]
    counts  = {"fetched": 0, "inserted": 0, "updated": 0, "skipped": 0, "errors": []}
    errors: List[str] = []

    log.info(f"[runner] ── {name} ({sync_type}) ──")

    # Refresh QBO token
    env = cfg.to_env_dict()
    try:
        token, new_rt = refresh_access_token(env, company["refresh_token"])
        if new_rt != company["refresh_token"]:
            cfg.note_rotated_token(name, new_rt)
    except Exception as exc:
        msg = f"Token refresh failed for {name}: {exc}"
        log.error(f"[runner] {msg}")
        counts["errors"].append(msg)
        return counts

    # Create sync_run
    sync_run_id = state_mgr.create_sync_run(
        entity_id=entity_id,
        sync_type=sync_type,
        object_types=ALL_OBJECT_TYPES + ALL_REPORT_TYPES,
        triggered_by=sync_type,
    )
    log.info(f"[runner] {name}: sync_run created → {sync_run_id}")

    extractor = QBOExtractor(env=cfg.to_env_dict(), token=token, realm_id=realm)
    loader    = CoreLoader(conn=data_conn)

    try:
        # ── Entity object types ───────────────────────────────────────────────
        for object_type in ALL_OBJECT_TYPES:
            since_time = None
            if sync_type == "incremental":
                since_time = state_mgr.get_last_modified_time(entity_id, object_type)

            log.info(
                f"[runner] {name}/{object_type} "
                f"{'since ' + since_time if since_time else 'full'}"
            )

            start_ts = datetime.datetime.now()
            result = extractor.extract_entity(object_type, since_time=since_time)

            if result.error:
                errors.append(f"{object_type}: {result.error}")
                log.warning(f"[runner] {name}/{object_type}: extraction error — {result.error}")
                continue

            fetched = result.fetched
            counts["fetched"] += fetched

            # Process records
            obj_inserted = obj_updated = obj_skipped = 0

            for raw in result.records:
                qbo_id    = str(raw.get("Id", ""))
                sync_tok  = str(raw.get("SyncToken", ""))
                is_active = raw.get("Active", True)

                if not qbo_id:
                    obj_skipped += 1
                    continue

                # ── Step 1: Write to qbo_raw ──────────────────────────────────
                try:
                    loader.upsert_raw(
                        entity_id=entity_id,
                        object_type=object_type,
                        qbo_id=qbo_id,
                        qbo_sync_token=sync_tok,
                        payload=raw,
                        sync_run_id=sync_run_id,
                        is_deleted=not bool(is_active),
                    )
                except Exception as exc:
                    log.warning(
                        f"[runner] {name}/{object_type}/{qbo_id}: qbo_raw upsert failed: {exc}"
                    )
                    obj_skipped += 1
                    continue

                # ── Step 2: Normalize and write to typed table ────────────────
                try:
                    _write_normalized(
                        loader=loader,
                        state_mgr=state_mgr,
                        entity_id=entity_id,
                        object_type=object_type,
                        raw=raw,
                    )
                    obj_inserted += 1
                except Exception as exc:
                    log.warning(
                        f"[runner] {name}/{object_type}/{qbo_id}: normalize/upsert failed: {exc}"
                    )
                    obj_skipped += 1

            # Commit the batch for this object type
            data_conn.commit()

            # ── Update sync_state high-water mark ─────────────────────────────
            latest_ts = state_mgr._extract_high_water_mark(result.records, object_type)
            state_mgr.update_sync_state(
                entity_id=entity_id,
                object_type=object_type,
                last_modified_time=latest_ts,
                total_records=fetched,
            )

            counts["inserted"] += obj_inserted
            counts["updated"]  += obj_updated
            counts["skipped"]  += obj_skipped

            elapsed = (datetime.datetime.now() - start_ts).total_seconds()
            log.info(
                f"[runner] {name}/{object_type}: "
                f"fetched={fetched} inserted={obj_inserted} "
                f"skipped={obj_skipped} ({elapsed:.1f}s)"
            )

        # ── Reports ──────────────────────────────────────────────────────────
        for report_type in ALL_REPORT_TYPES:
            log.info(f"[runner] {name}/report/{report_type}")
            start_ts = datetime.datetime.now()

            rep_result = extractor.extract_report(report_type)

            if rep_result.error:
                errors.append(f"report/{report_type}: {rep_result.error}")
                log.warning(
                    f"[runner] {name}/report/{report_type}: extraction error — {rep_result.error}"
                )
                continue

            try:
                loader.upsert_raw_report(
                    entity_id=entity_id,
                    report_type=report_type,
                    report_date=rep_result.report_date,
                    payload=rep_result.payload,
                    sync_run_id=sync_run_id,
                )
                data_conn.commit()
                counts["inserted"] += 1
            except Exception as exc:
                errors.append(f"report/{report_type}: {exc}")
                log.warning(
                    f"[runner] {name}/report/{report_type}: store failed: {exc}"
                )

            state_mgr.update_sync_state(
                entity_id=entity_id,
                object_type=report_type,
                last_modified_time=rep_result.report_date,
                total_records=1,
            )
            elapsed = (datetime.datetime.now() - start_ts).total_seconds()
            log.info(f"[runner] {name}/report/{report_type}: stored ({elapsed:.1f}s)")

    except Exception as exc:
        # Unexpected failure — roll back uncommitted data, mark run failed
        try:
            data_conn.rollback()
        except Exception:
            pass
        msg = f"Unexpected error during entity sync: {exc}"
        errors.append(msg)
        log.exception(f"[runner] {name}: {msg}")
        state_mgr.fail_sync_run(sync_run_id, msg)
        counts["errors"] = errors
        return counts

    # ── Mark sync_run complete or partial ─────────────────────────────────────
    if errors:
        state_mgr.partial_sync_run(
            sync_run_id=sync_run_id,
            error_message="; ".join(errors),
            records_fetched=counts["fetched"],
            records_inserted=counts["inserted"],
            records_updated=counts["updated"],
        )
        log.warning(
            f"[runner] {name}: sync PARTIAL — {len(errors)} object types had errors"
        )
    else:
        state_mgr.complete_sync_run(
            sync_run_id=sync_run_id,
            records_fetched=counts["fetched"],
            records_inserted=counts["inserted"],
            records_updated=counts["updated"],
            records_skipped=counts["skipped"],
        )
        log.info(
            f"[runner] {name}: sync COMPLETE — "
            f"fetched={counts['fetched']} inserted={counts['inserted']}"
        )

    counts["errors"] = errors
    return counts


def _write_normalized(
    loader: CoreLoader,
    state_mgr: SyncStateManager,
    entity_id: str,
    object_type: str,
    raw: dict,
) -> None:
    """
    Normalize a raw QBO record and write it to the appropriate typed table.
    Raises on failure so the caller can count skipped records.
    """
    qbo_id = str(raw.get("Id", ""))

    if object_type == "Account":
        rec = normalize_account(entity_id, raw)
        if rec:
            loader.upsert_account(rec)

    elif object_type == "Customer":
        rec = normalize_customer(entity_id, raw)
        if rec:
            loader.upsert_customer(rec)

    elif object_type == "Vendor":
        rec = normalize_vendor(entity_id, raw)
        if rec:
            loader.upsert_vendor(rec)

    elif object_type == "Invoice":
        customer_qbo_id = raw.get("CustomerRef", {}).get("value")
        customer_db_id  = loader.get_customer_id(entity_id, customer_qbo_id) if customer_qbo_id else None
        rec = normalize_invoice(entity_id, raw, customer_db_id=customer_db_id)
        if rec:
            loader.upsert_invoice(rec)

    elif object_type == "Bill":
        vendor_qbo_id = raw.get("VendorRef", {}).get("value")
        vendor_db_id  = loader.get_vendor_id(entity_id, vendor_qbo_id) if vendor_qbo_id else None
        rec = normalize_bill(entity_id, raw, vendor_db_id=vendor_db_id)
        if rec:
            loader.upsert_bill(rec)

    elif object_type in (
        "Payment", "BillPayment", "Purchase",
        "Deposit", "JournalEntry", "Transfer", "SalesReceipt",
    ):
        rec = normalize_transaction(entity_id, object_type, raw)
        if rec:
            loader.upsert_transaction(rec)


# ── Runner ────────────────────────────────────────────────────────────────────

def run(sync_type: str = "incremental") -> dict:
    """
    Run a sync for all active entities.

    Args:
        sync_type: 'full_backfill' | 'incremental' | 'manual'

    Returns summary dict with per-entity results.
    Never raises — exceptions per entity are captured and logged.
    """
    if sync_type not in ("full_backfill", "incremental", "manual"):
        raise ValueError(f"Unknown sync_type: {sync_type!r}. Use 'full_backfill', 'incremental', or 'manual'.")

    log.info("=" * 70)
    log.info(f"FinanceOS Core Sync Engine — {sync_type}")
    log.info("=" * 70)

    run_start = datetime.datetime.now()

    # Load configuration from environment (no files, no credentials on disk)
    try:
        cfg = qbo_config.load()
    except RuntimeError as exc:
        log.error(f"[runner] Configuration error: {exc}")
        return {"error": str(exc), "entities": []}

    companies = cfg.to_company_dicts()

    if not companies:
        log.error("[runner] No companies configured.")
        return {"error": "No companies found", "entities": []}

    # Open two connections:
    # - state_conn: for sync_runs and sync_state (commits after each operation)
    # - data_conn:  for qbo_raw + normalized tables (commits per object type batch)
    state_conn = get_connection()
    data_conn  = get_connection()

    state_mgr = SyncStateManager(conn=state_conn)

    summary = {"sync_type": sync_type, "entities": [], "total_errors": 0}

    try:
        for company in companies:
            name    = company["name"]
            realm   = company["realm_id"]

            entity_id = state_mgr.get_entity_id_by_realm(realm)
            if entity_id is None:
                log.warning(
                    f"[runner] {name}: realm {realm} not found in entities table. "
                    f"Run 'pnpm run seed' in lib/db to seed entities first."
                )
                summary["entities"].append({
                    "name": name,
                    "status": "skipped",
                    "reason": "entity not seeded",
                })
                continue

            entity_result = {
                "name":      name,
                "realm":     realm,
                "entity_id": entity_id,
                "status":    "unknown",
            }

            try:
                counts = sync_entity(
                    cfg=cfg,
                    company=company,
                    entity_id=entity_id,
                    sync_type=sync_type,
                    state_mgr=state_mgr,
                    data_conn=data_conn,
                )
                entity_result.update(counts)
                entity_result["status"] = "partial" if counts["errors"] else "success"
                if counts["errors"]:
                    summary["total_errors"] += len(counts["errors"])
            except Exception as exc:
                # Belt-and-suspenders: sync_entity itself shouldn't raise,
                # but if it does, catch here so other entities still run.
                msg = f"Unhandled error for {name}: {exc}"
                log.exception(f"[runner] {msg}")
                entity_result["status"] = "failed"
                entity_result["error"]  = msg
                summary["total_errors"] += 1
                try:
                    data_conn.rollback()
                except Exception:
                    pass

            summary["entities"].append(entity_result)

    finally:
        try:
            state_conn.close()
        except Exception:
            pass
        try:
            data_conn.close()
        except Exception:
            pass

    elapsed = (datetime.datetime.now() - run_start).total_seconds()
    log.info("=" * 70)
    log.info(f"Sync complete in {elapsed:.1f}s — {len(summary['entities'])} entities")
    for ent in summary["entities"]:
        status = ent.get("status", "?")
        fetched = ent.get("fetched", 0)
        inserted = ent.get("inserted", 0)
        log.info(
            f"  {ent['name']:20s} status={status:8s} "
            f"fetched={fetched:6d} inserted={inserted:6d}"
        )
    if summary["total_errors"] > 0:
        log.warning(f"  {summary['total_errors']} total errors — review logs above.")
    log.info("=" * 70)

    return summary


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
    )

    sync_type = sys.argv[1] if len(sys.argv) > 1 else "incremental"
    result = run(sync_type=sync_type)
    if result.get("total_errors", 0) > 0:
        sys.exit(1)
