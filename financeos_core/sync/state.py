"""
financeos_core/sync/state.py
------------------------------
Reads and writes sync_runs and sync_state tables.

Responsibilities:
    - Create sync_run record at start of each entity sync
    - Update sync_run on completion or failure
    - Read entity DB UUID by slug or realm_id
    - Read/write sync_state high-water marks for incremental sync
    - All DB operations are committed immediately (separate transaction from data writes)

Never logs credentials, tokens, or QBO payloads.
"""

import logging
import datetime
from typing import Optional, List
import psycopg2
import psycopg2.extras

log = logging.getLogger(__name__)


class SyncStateManager:
    """
    Manages sync_runs and sync_state entries for the FinanceOS Core sync engine.

    Args:
        conn: psycopg2 connection with RealDictCursor factory.
              The manager commits its own operations immediately
              (sync tracking uses a separate transaction from data writes).
    """

    def __init__(self, conn: psycopg2.extensions.connection):
        self._conn = conn

    def _cursor(self):
        return self._conn.cursor()

    # ── Entity lookup ─────────────────────────────────────────────────────────

    def get_entity_id_by_realm(self, realm_id: str) -> Optional[str]:
        """
        Look up the DB UUID of an entity by its QBO realm_id.
        Returns None if not found (entity not seeded).
        """
        with self._cursor() as cur:
            cur.execute(
                "SELECT id FROM entities WHERE qbo_realm_id = %s AND status = 'active'",
                (realm_id,),
            )
            row = cur.fetchone()
            if row:
                return str(row["id"])
            return None

    def get_all_active_entities(self) -> List[dict]:
        """
        Return all active entities as a list of dicts with id, slug, display_name.
        """
        with self._cursor() as cur:
            cur.execute(
                "SELECT id, slug, display_name, qbo_realm_id "
                "FROM entities WHERE status = 'active' ORDER BY slug"
            )
            return [dict(row) for row in cur.fetchall()]

    # ── sync_runs ─────────────────────────────────────────────────────────────

    def create_sync_run(
        self,
        entity_id: str,
        sync_type: str,
        object_types: List[str],
        triggered_by: str = "manual",
    ) -> str:
        """
        Insert a new sync_run record with status='running'.
        Returns the UUID of the created sync_run.
        Committed immediately.
        """
        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO sync_runs (
                    entity_id, sync_type, object_types,
                    started_at, status, triggered_by
                )
                VALUES (%s, %s, %s, now(), 'running', %s)
                RETURNING id
                """,
                (entity_id, sync_type, object_types, triggered_by),
            )
            row = cur.fetchone()
            self._conn.commit()
            run_id = str(row["id"])
            log.debug(f"[state] Created sync_run {run_id} for entity {entity_id}")
            return run_id

    def complete_sync_run(
        self,
        sync_run_id: str,
        records_fetched: int = 0,
        records_inserted: int = 0,
        records_updated: int = 0,
        records_skipped: int = 0,
        qbo_rate_limit_hits: int = 0,
    ) -> None:
        """Mark a sync_run as successfully completed."""
        with self._cursor() as cur:
            cur.execute(
                """
                UPDATE sync_runs SET
                    status              = 'success',
                    completed_at        = now(),
                    records_fetched     = %s,
                    records_inserted    = %s,
                    records_updated     = %s,
                    records_skipped     = %s,
                    qbo_rate_limit_hits = %s
                WHERE id = %s
                """,
                (
                    records_fetched,
                    records_inserted,
                    records_updated,
                    records_skipped,
                    qbo_rate_limit_hits,
                    sync_run_id,
                ),
            )
            self._conn.commit()
            log.debug(
                f"[state] sync_run {sync_run_id} complete — "
                f"fetched={records_fetched} inserted={records_inserted} "
                f"updated={records_updated} skipped={records_skipped}"
            )

    def fail_sync_run(self, sync_run_id: str, error_message: str) -> None:
        """Mark a sync_run as failed with the given error message."""
        with self._cursor() as cur:
            cur.execute(
                """
                UPDATE sync_runs SET
                    status        = 'failed',
                    completed_at  = now(),
                    error_message = %s
                WHERE id = %s
                """,
                (error_message[:2000], sync_run_id),  # cap at 2000 chars
            )
            self._conn.commit()
            log.debug(f"[state] sync_run {sync_run_id} marked FAILED")

    def partial_sync_run(
        self,
        sync_run_id: str,
        error_message: str,
        records_fetched: int = 0,
        records_inserted: int = 0,
        records_updated: int = 0,
    ) -> None:
        """Mark a sync_run as partially complete (some object types failed)."""
        with self._cursor() as cur:
            cur.execute(
                """
                UPDATE sync_runs SET
                    status           = 'partial',
                    completed_at     = now(),
                    error_message    = %s,
                    records_fetched  = %s,
                    records_inserted = %s,
                    records_updated  = %s
                WHERE id = %s
                """,
                (
                    error_message[:2000],
                    records_fetched,
                    records_inserted,
                    records_updated,
                    sync_run_id,
                ),
            )
            self._conn.commit()

    # ── sync_state ────────────────────────────────────────────────────────────

    def get_last_modified_time(self, entity_id: str, object_type: str) -> Optional[str]:
        """
        Return the last high-water mark for incremental sync.
        Returns an ISO timestamp string or None if this object type was never synced.
        """
        with self._cursor() as cur:
            cur.execute(
                """
                SELECT last_modified_time
                FROM sync_state
                WHERE entity_id = %s AND object_type = %s
                """,
                (entity_id, object_type),
            )
            row = cur.fetchone()
            if row and row["last_modified_time"]:
                # Return as ISO string for use in QBO query
                val = row["last_modified_time"]
                if hasattr(val, "isoformat"):
                    return val.isoformat()
                return str(val)
            return None

    def update_sync_state(
        self,
        entity_id: str,
        object_type: str,
        last_modified_time: Optional[str],
        total_records: int,
    ) -> None:
        """
        Upsert the sync_state high-water mark for one entity + object type.
        Committed immediately.
        """
        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO sync_state (entity_id, object_type, last_sync_at, last_modified_time, total_records)
                VALUES (%s, %s, now(), %s, %s)
                ON CONFLICT (entity_id, object_type)
                DO UPDATE SET
                    last_sync_at       = now(),
                    last_modified_time = COALESCE(EXCLUDED.last_modified_time, sync_state.last_modified_time),
                    total_records      = EXCLUDED.total_records
                """,
                (entity_id, object_type, last_modified_time, total_records),
            )
            self._conn.commit()

    def _extract_high_water_mark(self, records: list, object_type: str) -> Optional[str]:
        """
        Find the most recent LastUpdatedTime across a list of raw QBO records.
        Returns ISO string or None.
        """
        if not records:
            return None
        latest = None
        for rec in records:
            meta = rec.get("MetaData", {})
            ts = meta.get("LastUpdatedTime")
            if ts:
                if latest is None or ts > latest:
                    latest = ts
        return latest
