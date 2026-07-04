"""
financeos_core/sync/loader.py
-------------------------------
UPSERT layer — writes raw QBO payloads and normalized records to PostgreSQL.

Design principles:
    - Raw first: qbo_raw is always written before normalized tables
    - Idempotent: every write uses ON CONFLICT DO UPDATE (never fails on re-run)
    - Soft deletes: inactive QBO records are marked is_deleted=true, not removed
    - No business logic: no KPI computation, no snapshot building
    - Counts returned for logging: inserted, updated (rows matched vs changed)
    - Never logs payloads, credentials, or token values
"""

import json
import logging
from typing import Optional
import psycopg2
import psycopg2.extras

log = logging.getLogger(__name__)


class CoreLoader:
    """
    Writes raw and normalized records to the FinanceOS Core Database.

    Args:
        conn: psycopg2 connection. The loader does NOT commit or close —
              the runner is responsible for transaction management.
    """

    def __init__(self, conn: psycopg2.extensions.connection):
        self._conn = conn

    def _cursor(self):
        return self._conn.cursor()

    # ── qbo_raw ───────────────────────────────────────────────────────────────

    def upsert_raw(
        self,
        entity_id: str,
        object_type: str,
        qbo_id: str,
        qbo_sync_token: Optional[str],
        payload: dict,
        sync_run_id: Optional[str],
        is_deleted: bool = False,
    ) -> bool:
        """
        Upsert one raw QBO object into qbo_raw.
        Returns True if the row was newly inserted, False if updated.
        """
        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO qbo_raw (
                    entity_id, object_type, qbo_id, qbo_sync_token,
                    payload, synced_at, sync_run_id, is_deleted
                )
                VALUES (%s, %s, %s, %s, %s, now(), %s, %s)
                ON CONFLICT (entity_id, object_type, qbo_id)
                DO UPDATE SET
                    qbo_sync_token = EXCLUDED.qbo_sync_token,
                    payload        = EXCLUDED.payload,
                    synced_at      = now(),
                    sync_run_id    = EXCLUDED.sync_run_id,
                    is_deleted     = EXCLUDED.is_deleted
                """,
                (
                    entity_id,
                    object_type,
                    qbo_id,
                    qbo_sync_token,
                    psycopg2.extras.Json(payload),
                    sync_run_id,
                    is_deleted,
                ),
            )
            return cur.rowcount == 1

    def upsert_raw_batch(
        self,
        rows: list,
        batch_size: int = 500,
    ) -> int:
        """
        Batch-upsert a list of raw QBO objects into qbo_raw.
        Each item in rows must be a dict with keys:
            entity_id, object_type, qbo_id, qbo_sync_token,
            payload, sync_run_id, is_deleted
        Returns total rows processed (inserts + updates).
        """
        if not rows:
            return 0
        tuples = [
            (
                r["entity_id"],
                r["object_type"],
                r["qbo_id"],
                r["qbo_sync_token"],
                psycopg2.extras.Json(r["payload"]),
                r["sync_run_id"],
                r["is_deleted"],
            )
            for r in rows
        ]
        total = 0
        n_batches = (len(tuples) + batch_size - 1) // batch_size
        for i in range(0, len(tuples), batch_size):
            chunk = tuples[i : i + batch_size]
            batch_num = i // batch_size + 1
            with self._cursor() as cur:
                psycopg2.extras.execute_values(
                    cur,
                    """
                    INSERT INTO qbo_raw (
                        entity_id, object_type, qbo_id, qbo_sync_token,
                        payload, synced_at, sync_run_id, is_deleted
                    )
                    VALUES %s
                    ON CONFLICT (entity_id, object_type, qbo_id)
                    DO UPDATE SET
                        qbo_sync_token = EXCLUDED.qbo_sync_token,
                        payload        = EXCLUDED.payload,
                        synced_at      = now(),
                        sync_run_id    = EXCLUDED.sync_run_id,
                        is_deleted     = EXCLUDED.is_deleted
                    """,
                    chunk,
                    template="(%s, %s, %s, %s, %s, now(), %s, %s)",
                    page_size=batch_size,
                )
                total += cur.rowcount
            log.info(f"[loader] qbo_raw batch {batch_num}/{n_batches}: {len(chunk)} records")
        return total

    def upsert_accounts_batch(self, records: list, batch_size: int = 500) -> int:
        """
        Batch-upsert normalized account records.
        Each item must be a dict matching the accounts table columns.
        Returns total rows processed.
        """
        if not records:
            return 0
        tuples = [
            (
                r["entity_id"], r["qbo_id"], r["name"], r["fully_qualified_name"],
                r["account_type"], r["account_subtype"], r["classification"],
                r["current_balance"], r["currency"], r["is_active"],
                r["is_sub_account"], r["parent_qbo_id"],
            )
            for r in records
        ]
        total = 0
        n_batches = (len(tuples) + batch_size - 1) // batch_size
        for i in range(0, len(tuples), batch_size):
            chunk = tuples[i : i + batch_size]
            batch_num = i // batch_size + 1
            with self._cursor() as cur:
                psycopg2.extras.execute_values(
                    cur,
                    """
                    INSERT INTO accounts (
                        entity_id, qbo_id, name, fully_qualified_name,
                        account_type, account_subtype, classification,
                        current_balance, currency, is_active,
                        is_sub_account, parent_qbo_id, synced_at
                    )
                    VALUES %s
                    ON CONFLICT (entity_id, qbo_id)
                    DO UPDATE SET
                        name                 = EXCLUDED.name,
                        fully_qualified_name = EXCLUDED.fully_qualified_name,
                        account_type         = EXCLUDED.account_type,
                        account_subtype      = EXCLUDED.account_subtype,
                        classification       = EXCLUDED.classification,
                        current_balance      = EXCLUDED.current_balance,
                        currency             = EXCLUDED.currency,
                        is_active            = EXCLUDED.is_active,
                        is_sub_account       = EXCLUDED.is_sub_account,
                        parent_qbo_id        = EXCLUDED.parent_qbo_id,
                        synced_at            = now()
                    """,
                    chunk,
                    template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())",
                    page_size=batch_size,
                )
                total += cur.rowcount
            log.info(f"[loader] accounts batch {batch_num}/{n_batches}: {len(chunk)} records")
        return total

    def upsert_customers_batch(self, records: list, batch_size: int = 500) -> int:
        """
        Batch-upsert normalized customer records.
        Returns total rows processed.
        """
        if not records:
            return 0
        tuples = [
            (
                r["entity_id"], r["qbo_id"], r["display_name"], r["email"],
                r["phone"], r["balance"], r["currency"], r["is_active"],
            )
            for r in records
        ]
        total = 0
        n_batches = (len(tuples) + batch_size - 1) // batch_size
        for i in range(0, len(tuples), batch_size):
            chunk = tuples[i : i + batch_size]
            batch_num = i // batch_size + 1
            with self._cursor() as cur:
                psycopg2.extras.execute_values(
                    cur,
                    """
                    INSERT INTO customers (
                        entity_id, qbo_id, display_name, email, phone,
                        balance, currency, is_active, synced_at
                    )
                    VALUES %s
                    ON CONFLICT (entity_id, qbo_id)
                    DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        email        = EXCLUDED.email,
                        phone        = EXCLUDED.phone,
                        balance      = EXCLUDED.balance,
                        currency     = EXCLUDED.currency,
                        is_active    = EXCLUDED.is_active,
                        synced_at    = now()
                    """,
                    chunk,
                    template="(%s,%s,%s,%s,%s,%s,%s,%s,now())",
                    page_size=batch_size,
                )
                total += cur.rowcount
            log.info(f"[loader] customers batch {batch_num}/{n_batches}: {len(chunk)} records")
        return total

    def upsert_vendors_batch(self, records: list, batch_size: int = 500) -> int:
        """
        Batch-upsert normalized vendor records.
        Returns total rows processed.
        """
        if not records:
            return 0
        tuples = [
            (
                r["entity_id"], r["qbo_id"], r["display_name"], r["email"],
                r["balance"], r["currency"], r["is_active"],
            )
            for r in records
        ]
        total = 0
        n_batches = (len(tuples) + batch_size - 1) // batch_size
        for i in range(0, len(tuples), batch_size):
            chunk = tuples[i : i + batch_size]
            batch_num = i // batch_size + 1
            with self._cursor() as cur:
                psycopg2.extras.execute_values(
                    cur,
                    """
                    INSERT INTO vendors (
                        entity_id, qbo_id, display_name, email,
                        balance, currency, is_active, synced_at
                    )
                    VALUES %s
                    ON CONFLICT (entity_id, qbo_id)
                    DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        email        = EXCLUDED.email,
                        balance      = EXCLUDED.balance,
                        currency     = EXCLUDED.currency,
                        is_active    = EXCLUDED.is_active,
                        synced_at    = now()
                    """,
                    chunk,
                    template="(%s,%s,%s,%s,%s,%s,%s,now())",
                    page_size=batch_size,
                )
                total += cur.rowcount
            log.info(f"[loader] vendors batch {batch_num}/{n_batches}: {len(chunk)} records")
        return total

    def upsert_raw_report(
        self,
        entity_id: str,
        report_type: str,
        report_date: str,
        payload: dict,
        sync_run_id: Optional[str],
    ) -> None:
        """
        Upsert a full QBO report payload into qbo_raw.
        qbo_id for reports is composed as '{report_type}_{report_date}',
        creating a stable key that updates in-place on each sync.
        """
        qbo_id = f"{report_type}_{report_date}"
        self.upsert_raw(
            entity_id=entity_id,
            object_type=report_type,
            qbo_id=qbo_id,
            qbo_sync_token=None,
            payload=payload,
            sync_run_id=sync_run_id,
            is_deleted=False,
        )

    # ── accounts ──────────────────────────────────────────────────────────────

    def upsert_account(self, record: dict) -> str:
        """
        Upsert one account record. Returns the DB UUID of the upserted row.
        """
        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO accounts (
                    entity_id, qbo_id, name, fully_qualified_name,
                    account_type, account_subtype, classification,
                    current_balance, currency, is_active, is_sub_account,
                    parent_qbo_id, synced_at
                )
                VALUES (
                    %(entity_id)s, %(qbo_id)s, %(name)s, %(fully_qualified_name)s,
                    %(account_type)s, %(account_subtype)s, %(classification)s,
                    %(current_balance)s, %(currency)s, %(is_active)s, %(is_sub_account)s,
                    %(parent_qbo_id)s, now()
                )
                ON CONFLICT (entity_id, qbo_id)
                DO UPDATE SET
                    name                 = EXCLUDED.name,
                    fully_qualified_name = EXCLUDED.fully_qualified_name,
                    account_type         = EXCLUDED.account_type,
                    account_subtype      = EXCLUDED.account_subtype,
                    classification       = EXCLUDED.classification,
                    current_balance      = EXCLUDED.current_balance,
                    currency             = EXCLUDED.currency,
                    is_active            = EXCLUDED.is_active,
                    is_sub_account       = EXCLUDED.is_sub_account,
                    parent_qbo_id        = EXCLUDED.parent_qbo_id,
                    synced_at            = now()
                RETURNING id
                """,
                record,
            )
            row = cur.fetchone()
            return str(row["id"]) if row else ""

    def get_account_id(self, entity_id: str, qbo_id: str) -> Optional[str]:
        """Look up the DB UUID for an account by entity + QBO ID."""
        with self._cursor() as cur:
            cur.execute(
                "SELECT id FROM accounts WHERE entity_id = %s AND qbo_id = %s",
                (entity_id, qbo_id),
            )
            row = cur.fetchone()
            return str(row["id"]) if row else None

    # ── customers ─────────────────────────────────────────────────────────────

    def upsert_customer(self, record: dict) -> str:
        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO customers (
                    entity_id, qbo_id, display_name, email, phone,
                    balance, currency, is_active, synced_at
                )
                VALUES (
                    %(entity_id)s, %(qbo_id)s, %(display_name)s, %(email)s, %(phone)s,
                    %(balance)s, %(currency)s, %(is_active)s, now()
                )
                ON CONFLICT (entity_id, qbo_id)
                DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    email        = EXCLUDED.email,
                    phone        = EXCLUDED.phone,
                    balance      = EXCLUDED.balance,
                    currency     = EXCLUDED.currency,
                    is_active    = EXCLUDED.is_active,
                    synced_at    = now()
                RETURNING id
                """,
                record,
            )
            row = cur.fetchone()
            return str(row["id"]) if row else ""

    def get_customer_id(self, entity_id: str, qbo_id: str) -> Optional[str]:
        with self._cursor() as cur:
            cur.execute(
                "SELECT id FROM customers WHERE entity_id = %s AND qbo_id = %s",
                (entity_id, qbo_id),
            )
            row = cur.fetchone()
            return str(row["id"]) if row else None

    # ── vendors ───────────────────────────────────────────────────────────────

    def upsert_vendor(self, record: dict) -> str:
        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO vendors (
                    entity_id, qbo_id, display_name, email,
                    balance, currency, is_active, synced_at
                )
                VALUES (
                    %(entity_id)s, %(qbo_id)s, %(display_name)s, %(email)s,
                    %(balance)s, %(currency)s, %(is_active)s, now()
                )
                ON CONFLICT (entity_id, qbo_id)
                DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    email        = EXCLUDED.email,
                    balance      = EXCLUDED.balance,
                    currency     = EXCLUDED.currency,
                    is_active    = EXCLUDED.is_active,
                    synced_at    = now()
                RETURNING id
                """,
                record,
            )
            row = cur.fetchone()
            return str(row["id"]) if row else ""

    def get_vendor_id(self, entity_id: str, qbo_id: str) -> Optional[str]:
        with self._cursor() as cur:
            cur.execute(
                "SELECT id FROM vendors WHERE entity_id = %s AND qbo_id = %s",
                (entity_id, qbo_id),
            )
            row = cur.fetchone()
            return str(row["id"]) if row else None

    # ── invoices ──────────────────────────────────────────────────────────────

    def upsert_invoice(self, record: dict) -> None:
        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO invoices (
                    entity_id, qbo_id, customer_id, customer_name,
                    invoice_date, due_date, amount, balance, status,
                    days_overdue, currency, memo, is_deleted, synced_at
                )
                VALUES (
                    %(entity_id)s, %(qbo_id)s, %(customer_id)s, %(customer_name)s,
                    %(invoice_date)s, %(due_date)s, %(amount)s, %(balance)s, %(status)s,
                    %(days_overdue)s, %(currency)s, %(memo)s, %(is_deleted)s, now()
                )
                ON CONFLICT (entity_id, qbo_id)
                DO UPDATE SET
                    customer_id   = EXCLUDED.customer_id,
                    customer_name = EXCLUDED.customer_name,
                    invoice_date  = EXCLUDED.invoice_date,
                    due_date      = EXCLUDED.due_date,
                    amount        = EXCLUDED.amount,
                    balance       = EXCLUDED.balance,
                    status        = EXCLUDED.status,
                    days_overdue  = EXCLUDED.days_overdue,
                    currency      = EXCLUDED.currency,
                    memo          = EXCLUDED.memo,
                    is_deleted    = EXCLUDED.is_deleted,
                    synced_at     = now()
                """,
                record,
            )

    # ── bills ─────────────────────────────────────────────────────────────────

    def upsert_bill(self, record: dict) -> None:
        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO bills (
                    entity_id, qbo_id, vendor_id, vendor_name,
                    bill_date, due_date, amount, balance, status,
                    days_overdue, currency, memo, is_deleted, synced_at
                )
                VALUES (
                    %(entity_id)s, %(qbo_id)s, %(vendor_id)s, %(vendor_name)s,
                    %(bill_date)s, %(due_date)s, %(amount)s, %(balance)s, %(status)s,
                    %(days_overdue)s, %(currency)s, %(memo)s, %(is_deleted)s, now()
                )
                ON CONFLICT (entity_id, qbo_id)
                DO UPDATE SET
                    vendor_id    = EXCLUDED.vendor_id,
                    vendor_name  = EXCLUDED.vendor_name,
                    bill_date    = EXCLUDED.bill_date,
                    due_date     = EXCLUDED.due_date,
                    amount       = EXCLUDED.amount,
                    balance      = EXCLUDED.balance,
                    status       = EXCLUDED.status,
                    days_overdue = EXCLUDED.days_overdue,
                    currency     = EXCLUDED.currency,
                    memo         = EXCLUDED.memo,
                    is_deleted   = EXCLUDED.is_deleted,
                    synced_at    = now()
                """,
                record,
            )

    # ── transactions ──────────────────────────────────────────────────────────

    def upsert_transaction(self, record: dict) -> None:
        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO transactions (
                    entity_id, qbo_id, transaction_type, transaction_date,
                    amount, account_id, account_name, entity_ref, memo,
                    category, currency, is_reconciled, is_deleted, synced_at
                )
                VALUES (
                    %(entity_id)s, %(qbo_id)s, %(transaction_type)s, %(transaction_date)s,
                    %(amount)s, %(account_id)s, %(account_name)s, %(entity_ref)s, %(memo)s,
                    %(category)s, %(currency)s, %(is_reconciled)s, %(is_deleted)s, now()
                )
                ON CONFLICT (entity_id, transaction_type, qbo_id)
                DO UPDATE SET
                    transaction_date = EXCLUDED.transaction_date,
                    amount           = EXCLUDED.amount,
                    account_id       = EXCLUDED.account_id,
                    account_name     = EXCLUDED.account_name,
                    entity_ref       = EXCLUDED.entity_ref,
                    memo             = EXCLUDED.memo,
                    category         = EXCLUDED.category,
                    currency         = EXCLUDED.currency,
                    is_reconciled    = EXCLUDED.is_reconciled,
                    is_deleted       = EXCLUDED.is_deleted,
                    synced_at        = now()
                """,
                record,
            )
