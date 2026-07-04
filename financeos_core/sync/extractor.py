"""
financeos_core/sync/extractor.py
----------------------------------
QBO extraction layer for the Core sync engine.

Returns raw QBO JSON objects — no flattening, no business logic.
The loader layer is responsible for storing these in qbo_raw.
The normalizer layer converts them to typed DB records.

Reuses without modification:
    connectors.quickbooks.query_entity()   — paginated entity queries
    connectors.quickbooks.get_report()     — report endpoint
    connectors.quickbooks._query_page()    — single-page query (for incremental)
    connectors.quickbooks.parse_amount()   — amount parsing

Adds:
    - Rate limiting (one limiter per realm via rate_limiter module)
    - Retry on transient failures (via retry decorator)
    - Incremental sync support (LastUpdatedTime filter)
    - Full-history support (no date filter)
    - Typed dataclass results
"""

import logging
import datetime
from dataclasses import dataclass, field
from typing import Any, List, Optional

from connectors.quickbooks import (
    _query_page,
    get_report,
    parse_amount,
)
from financeos_core.sync.rate_limiter import get_limiter
from financeos_core.sync.retry import with_retry, RetryableError, PermanentError

log = logging.getLogger(__name__)

TODAY = datetime.date.today().isoformat()
YEAR_START = f"{datetime.date.today().year}-01-01"

# QBO entity object types that have a LastUpdatedTime field (incremental-capable)
INCREMENTAL_ENTITIES = {
    "Account",
    "Customer",
    "Vendor",
    "Invoice",
    "Bill",
    "Payment",
    "BillPayment",
    "Purchase",
    "Deposit",
    "JournalEntry",
    "Transfer",
    "SalesReceipt",
}

# Report types — no incremental support; always fetch current snapshot
REPORT_TYPES = {
    "ProfitAndLoss",
    "BalanceSheet",
    "AgedReceivableDetail",
    "AgedPayableDetail",
}


@dataclass
class ExtractedObjects:
    """Result of extracting one object type for one entity."""
    object_type: str
    realm_id: str
    records: List[dict] = field(default_factory=list)
    fetched: int = 0
    error: Optional[str] = None


@dataclass
class ExtractedReport:
    """Result of extracting one report type for one entity."""
    report_type: str
    realm_id: str
    report_date: str = ""
    payload: dict = field(default_factory=dict)
    error: Optional[str] = None


class QBOExtractor:
    """
    Stateless extractor for one QBO company (realm).

    Args:
        env:      Dict from connectors.quickbooks.load_env()
        token:    Valid QBO access token (caller refreshes before use)
        realm_id: QBO Company ID (realm_id from companies.json)
    """

    def __init__(self, env: dict, token: str, realm_id: str):
        self._env = env
        self._token = token
        self._realm = realm_id
        self._limiter = get_limiter(realm_id)

    # ── Entity extraction ─────────────────────────────────────────────────────

    def extract_entity(
        self,
        object_type: str,
        since_time: Optional[str] = None,
    ) -> ExtractedObjects:
        """
        Extract all records of the given QBO object type.

        Args:
            object_type: QBO entity name ('Account', 'Invoice', etc.)
            since_time:  ISO timestamp string for incremental sync.
                         If provided, filters WHERE LastUpdatedTime >= since_time.
                         If None, fetches all records (full backfill).

        Returns ExtractedObjects with raw QBO dicts.
        Never raises — errors are captured in ExtractedObjects.error.
        """
        result = ExtractedObjects(object_type=object_type, realm_id=self._realm)
        try:
            rows = self._paginate_entity(object_type, since_time)
            result.records = rows
            result.fetched = len(rows)
        except PermanentError as exc:
            result.error = f"Permanent QBO error: {exc}"
            log.error(f"[extractor] {object_type}/{self._realm}: {exc}")
        except Exception as exc:
            result.error = str(exc)
            log.error(f"[extractor] {object_type}/{self._realm}: unexpected error: {exc}")
        return result

    def _paginate_entity(self, object_type: str, since_time: Optional[str]) -> List[dict]:
        """
        Paginate through all QBO records for the given object type.
        Applies LastUpdatedTime filter if since_time is provided.
        """
        # Entities that must be filtered to active-only (inactive records skew counts)
        ACTIVE_ONLY = {"Customer", "Vendor"}

        # QBO SQL requires MetaData.LastUpdatedTime (not bare LastUpdatedTime)
        # and a full ISO timestamp with timezone offset.
        def _qbo_timestamp(dt_str: str) -> str:
            """Ensure dt_str has a time+offset component for QBO SQL."""
            if "T" not in dt_str:
                return dt_str + "T00:00:00+00:00"
            return dt_str

        if since_time and object_type in INCREMENTAL_ENTITIES:
            ts = _qbo_timestamp(since_time)
            if object_type in ACTIVE_ONLY:
                sql = (
                    f"SELECT * FROM {object_type} "
                    f"WHERE Active = true AND MetaData.LastUpdatedTime >= '{ts}'"
                )
            else:
                sql = (
                    f"SELECT * FROM {object_type} "
                    f"WHERE MetaData.LastUpdatedTime >= '{ts}'"
                )
        elif object_type in ACTIVE_ONLY:
            # Full backfill — active records only
            sql = f"SELECT * FROM {object_type} WHERE Active = true"
        else:
            sql = f"SELECT * FROM {object_type}"

        rows: List[dict] = []
        start = 1
        page_size = 1000

        while True:
            self._limiter.acquire()
            page, _ = self._query_page_with_retry(sql, start, page_size)
            rows.extend(page)
            log.debug(
                f"[extractor] {object_type}/{self._realm} "
                f"page {start}–{start + len(page) - 1}: {len(page)} records"
            )
            if len(page) < page_size:
                break
            start += page_size

        return rows

    @with_retry(max_attempts=5, base_delay=1.0, max_delay=60.0)
    def _query_page_with_retry(self, sql: str, start: int, page_size: int):
        return _query_page(self._env, self._token, self._realm, sql, start, page_size)

    def extract_entity_by_txn_date(
        self,
        object_type: str,
        since_date: str,
    ) -> "ExtractedObjects":
        """
        Extract records filtered by TxnDate >= since_date.
        Used for controlled date-range validation (e.g. 2026-only AR/AP).
        TxnDate is the transaction's actual date, not its update time.
        Never raises — errors captured in ExtractedObjects.error.
        """
        result = ExtractedObjects(object_type=object_type, realm_id=self._realm)
        try:
            sql = f"SELECT * FROM {object_type} WHERE TxnDate >= '{since_date}'"
            rows = self._paginate_by_sql(sql)
            result.records = rows
            result.fetched = len(rows)
        except Exception as exc:
            result.error = str(exc)
            log.error(f"[extractor] {object_type}/{self._realm} (TxnDate): unexpected error: {exc}")
        return result

    def _paginate_by_sql(self, sql: str) -> List[dict]:
        """Paginate through QBO results for an arbitrary SQL query."""
        rows: List[dict] = []
        start = 1
        page_size = 1000
        while True:
            self._limiter.acquire()
            page, _ = self._query_page_with_retry(sql, start, page_size)
            rows.extend(page)
            if len(page) < page_size:
                break
            start += page_size
        return rows

    # ── Report extraction ─────────────────────────────────────────────────────

    def extract_report(self, report_type: str) -> ExtractedReport:
        """
        Fetch a QBO report (ProfitAndLoss, BalanceSheet, AgedReceivableDetail,
        AgedPayableDetail).

        Reports are always fetched in full — no incremental support.
        Returns ExtractedReport with the raw QBO report JSON.
        Never raises — errors captured in ExtractedReport.error.
        """
        result = ExtractedReport(
            report_type=report_type,
            realm_id=self._realm,
            report_date=TODAY,
        )
        try:
            self._limiter.acquire()
            params = self._report_params(report_type)
            payload = self._get_report_with_retry(report_type, params)
            result.payload = payload
        except PermanentError as exc:
            result.error = f"Permanent QBO error: {exc}"
            log.error(f"[extractor] report/{report_type}/{self._realm}: {exc}")
        except Exception as exc:
            result.error = str(exc)
            log.error(
                f"[extractor] report/{report_type}/{self._realm}: unexpected error: {exc}"
            )
        return result

    @with_retry(max_attempts=5, base_delay=2.0, max_delay=120.0)
    def _get_report_with_retry(self, report_type: str, params: dict) -> dict:
        return get_report(self._env, self._token, self._realm, report_type, params)

    def _report_params(self, report_type: str) -> dict:
        """Returns the QBO query parameters for each report type."""
        if report_type == "ProfitAndLoss":
            return {
                "start_date": YEAR_START,
                "end_date":   TODAY,
                "summarize_column_by": "Month",
                "minorversion": "65",
            }
        if report_type == "BalanceSheet":
            return {
                "end_date":          TODAY,
                "accounting_method": "Accrual",
                "minorversion":      "65",
            }
        if report_type in ("AgedReceivableDetail", "AgedPayableDetail"):
            return {"minorversion": "65"}
        return {"minorversion": "65"}
