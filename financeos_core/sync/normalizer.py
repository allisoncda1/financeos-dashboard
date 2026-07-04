"""
financeos_core/sync/normalizer.py
-----------------------------------
Converts raw QBO JSON objects into typed Python dicts matching the Core DB schema.

One normalize_*() function per DB table.
No database logic here. No business rules. Just field mapping.

Rules:
    - Always handle missing/None values gracefully
    - Never raise — return None for unprocessable records
    - entity_id is always a UUID string (passed by the runner)
    - qbo_id is always the QBO "Id" field (string)
    - Amounts are Decimal-safe strings (pass through as float, Postgres handles it)
    - Dates are ISO strings "YYYY-MM-DD" or None
"""

import datetime
import logging
from typing import Optional

log = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _str(val) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _ref_name(ref: dict) -> str:
    if isinstance(ref, dict):
        return ref.get("name", "") or ""
    return ""


def _ref_id(ref: dict) -> str:
    if isinstance(ref, dict):
        return ref.get("value", "") or ""
    return ""


def _float(val, default: float = 0.0) -> float:
    try:
        return float(val or 0)
    except (ValueError, TypeError):
        return default


def _bool(val, default: bool = True) -> bool:
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    return str(val).lower() not in ("false", "0", "no")


def _date(val) -> Optional[str]:
    """Return ISO date string or None."""
    if not val:
        return None
    s = str(val).strip()
    if len(s) >= 10:
        return s[:10]
    return None


def _days_overdue(due_date_str: Optional[str], balance: float) -> int:
    """Compute days past due relative to today. 0 if paid or not yet due."""
    if not due_date_str or balance <= 0:
        return 0
    try:
        due = datetime.date.fromisoformat(due_date_str[:10])
        today = datetime.date.today()
        delta = (today - due).days
        return max(0, delta)
    except (ValueError, TypeError):
        return 0


# ── Account ───────────────────────────────────────────────────────────────────

def normalize_account(entity_id: str, raw: dict) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    classification = _classify_account(raw.get("AccountType", ""))
    return {
        "entity_id":            entity_id,
        "qbo_id":               qbo_id,
        "name":                 _str(raw.get("Name")),
        "fully_qualified_name": _str(raw.get("FullyQualifiedName")),
        "account_type":         _str(raw.get("AccountType")),
        "account_subtype":      _str(raw.get("AccountSubType")),
        "classification":       classification,
        "current_balance":      _float(raw.get("CurrentBalance")),
        "currency":             _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "is_active":            _bool(raw.get("Active"), default=True),
        "is_sub_account":       _bool(raw.get("SubAccount"), default=False),
        "parent_qbo_id":        _ref_id(raw.get("ParentRef")),
    }


def _classify_account(account_type: str) -> str:
    mapping = {
        "Bank": "Asset",
        "Other Current Asset": "Asset",
        "Fixed Asset": "Asset",
        "Other Asset": "Asset",
        "Accounts Receivable": "Asset",
        "Credit Card": "Liability",
        "Accounts Payable": "Liability",
        "Other Current Liability": "Liability",
        "Long Term Liability": "Liability",
        "Equity": "Equity",
        "Income": "Revenue",
        "Other Income": "Revenue",
        "Cost of Goods Sold": "Expense",
        "Expense": "Expense",
        "Other Expense": "Expense",
    }
    return mapping.get(account_type, "Other")


# ── Customer ──────────────────────────────────────────────────────────────────

def normalize_customer(entity_id: str, raw: dict) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    email = None
    email_ref = raw.get("PrimaryEmailAddr")
    if isinstance(email_ref, dict):
        email = email_ref.get("Address")

    phone = None
    phone_ref = raw.get("PrimaryPhone")
    if isinstance(phone_ref, dict):
        phone = phone_ref.get("FreeFormNumber")

    return {
        "entity_id":    entity_id,
        "qbo_id":       qbo_id,
        "display_name": _str(raw.get("DisplayName")),
        "email":        _str(email) or None,
        "phone":        _str(phone) or None,
        "balance":      _float(raw.get("Balance")),
        "currency":     _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "is_active":    _bool(raw.get("Active"), default=True),
    }


# ── Vendor ────────────────────────────────────────────────────────────────────

def normalize_vendor(entity_id: str, raw: dict) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    email = None
    email_ref = raw.get("PrimaryEmailAddr")
    if isinstance(email_ref, dict):
        email = email_ref.get("Address")

    return {
        "entity_id":    entity_id,
        "qbo_id":       qbo_id,
        "display_name": _str(raw.get("DisplayName")),
        "email":        _str(email) or None,
        "balance":      _float(raw.get("Balance")),
        "currency":     _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "is_active":    _bool(raw.get("Active"), default=True),
    }


# ── Invoice ───────────────────────────────────────────────────────────────────

def normalize_invoice(
    entity_id: str,
    raw: dict,
    customer_db_id: Optional[str] = None,
) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    balance  = _float(raw.get("Balance"))
    due_date = _date(raw.get("DueDate"))
    status   = _derive_invoice_status(balance, due_date)
    return {
        "entity_id":      entity_id,
        "qbo_id":         qbo_id,
        "customer_id":    customer_db_id,
        "customer_name":  _ref_name(raw.get("CustomerRef")),
        "invoice_date":   _date(raw.get("TxnDate")),
        "due_date":       due_date,
        "amount":         _float(raw.get("TotalAmt")),
        "balance":        balance,
        "status":         status,
        "days_overdue":   _days_overdue(due_date, balance),
        "currency":       _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "memo":           _str(raw.get("PrivateNote") or raw.get("CustomerMemo", {}).get("value") or ""),
        "is_deleted":     not _bool(raw.get("Active"), default=True),
    }


def _derive_invoice_status(balance: float, due_date: Optional[str]) -> str:
    if balance <= 0:
        return "Paid"
    if due_date:
        try:
            if datetime.date.fromisoformat(due_date) < datetime.date.today():
                return "Overdue"
        except (ValueError, TypeError):
            pass
    return "Open"


# ── Bill ──────────────────────────────────────────────────────────────────────

def normalize_bill(
    entity_id: str,
    raw: dict,
    vendor_db_id: Optional[str] = None,
) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    balance  = _float(raw.get("Balance"))
    due_date = _date(raw.get("DueDate"))
    status   = _derive_invoice_status(balance, due_date)
    return {
        "entity_id":   entity_id,
        "qbo_id":      qbo_id,
        "vendor_id":   vendor_db_id,
        "vendor_name": _ref_name(raw.get("VendorRef")),
        "bill_date":   _date(raw.get("TxnDate")),
        "due_date":    due_date,
        "amount":      _float(raw.get("TotalAmt")),
        "balance":     balance,
        "status":      status,
        "days_overdue": _days_overdue(due_date, balance),
        "currency":    _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "memo":        _str(raw.get("PrivateNote") or ""),
        "is_deleted":  not _bool(raw.get("Active"), default=True),
    }


# ── Transactions ──────────────────────────────────────────────────────────────
# All money-movement types collapse into the transactions table.
# The transaction_type column records the QBO object type.

def normalize_payment(
    entity_id: str,
    raw: dict,
    account_db_id: Optional[str] = None,
) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    return {
        "entity_id":         entity_id,
        "qbo_id":            qbo_id,
        "transaction_type":  "Payment",
        "transaction_date":  _date(raw.get("TxnDate")),
        "amount":            _float(raw.get("TotalAmt")),
        "account_id":        account_db_id,
        "account_name":      _ref_name(raw.get("DepositToAccountRef")),
        "entity_ref":        _ref_name(raw.get("CustomerRef")),
        "memo":              _str(raw.get("PrivateNote") or ""),
        "category":          "Payment",
        "currency":          _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "is_reconciled":     False,
        "is_deleted":        False,
    }


def normalize_bill_payment(
    entity_id: str,
    raw: dict,
    account_db_id: Optional[str] = None,
) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    return {
        "entity_id":         entity_id,
        "qbo_id":            qbo_id,
        "transaction_type":  "BillPayment",
        "transaction_date":  _date(raw.get("TxnDate")),
        "amount":            _float(raw.get("TotalAmt")),
        "account_id":        account_db_id,
        "account_name":      _ref_name(
                                raw.get("CheckPayment", {}).get("BankAccountRef")
                                or raw.get("CreditCardPayment", {}).get("CCAccountRef")
                             ),
        "entity_ref":        _ref_name(raw.get("VendorRef")),
        "memo":              _str(raw.get("PrivateNote") or ""),
        "category":          "BillPayment",
        "currency":          _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "is_reconciled":     False,
        "is_deleted":        False,
    }


def normalize_deposit(
    entity_id: str,
    raw: dict,
    account_db_id: Optional[str] = None,
) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    return {
        "entity_id":         entity_id,
        "qbo_id":            qbo_id,
        "transaction_type":  "Deposit",
        "transaction_date":  _date(raw.get("TxnDate")),
        "amount":            _float(raw.get("TotalAmt")),
        "account_id":        account_db_id,
        "account_name":      _ref_name(raw.get("DepositToAccountRef")),
        "entity_ref":        "",
        "memo":              _str(raw.get("PrivateNote") or ""),
        "category":          "Deposit",
        "currency":          _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "is_reconciled":     False,
        "is_deleted":        False,
    }


def normalize_purchase(
    entity_id: str,
    raw: dict,
    account_db_id: Optional[str] = None,
) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    payment_type = _str(raw.get("PaymentType", ""))
    txn_type = "CreditCardCharge" if payment_type == "CreditCard" else "Purchase"
    return {
        "entity_id":         entity_id,
        "qbo_id":            qbo_id,
        "transaction_type":  txn_type,
        "transaction_date":  _date(raw.get("TxnDate")),
        "amount":            _float(raw.get("TotalAmt")),
        "account_id":        account_db_id,
        "account_name":      _ref_name(raw.get("AccountRef")),
        "entity_ref":        _ref_name(raw.get("EntityRef")),
        "memo":              _str(raw.get("PrivateNote") or raw.get("Memo") or ""),
        "category":          txn_type,
        "currency":          _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "is_reconciled":     False,
        "is_deleted":        False,
    }


def normalize_journal_entry(
    entity_id: str,
    raw: dict,
) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    total = _float(raw.get("TotalAmt"))
    return {
        "entity_id":         entity_id,
        "qbo_id":            qbo_id,
        "transaction_type":  "JournalEntry",
        "transaction_date":  _date(raw.get("TxnDate")),
        "amount":            total,
        "account_id":        None,
        "account_name":      "",
        "entity_ref":        "",
        "memo":              _str(raw.get("PrivateNote") or ""),
        "category":          "JournalEntry",
        "currency":          _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "is_reconciled":     False,
        "is_deleted":        False,
    }


def normalize_transfer(
    entity_id: str,
    raw: dict,
    from_account_db_id: Optional[str] = None,
) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    return {
        "entity_id":         entity_id,
        "qbo_id":            qbo_id,
        "transaction_type":  "Transfer",
        "transaction_date":  _date(raw.get("TxnDate")),
        "amount":            _float(raw.get("Amount")),
        "account_id":        from_account_db_id,
        "account_name":      _ref_name(raw.get("FromAccountRef")),
        "entity_ref":        _ref_name(raw.get("ToAccountRef")),
        "memo":              _str(raw.get("PrivateNote") or ""),
        "category":          "Transfer",
        "currency":          _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "is_reconciled":     False,
        "is_deleted":        False,
    }


def normalize_sales_receipt(
    entity_id: str,
    raw: dict,
    account_db_id: Optional[str] = None,
) -> Optional[dict]:
    qbo_id = _str(raw.get("Id"))
    if not qbo_id:
        return None
    return {
        "entity_id":         entity_id,
        "qbo_id":            qbo_id,
        "transaction_type":  "SalesReceipt",
        "transaction_date":  _date(raw.get("TxnDate")),
        "amount":            _float(raw.get("TotalAmt")),
        "account_id":        account_db_id,
        "account_name":      _ref_name(raw.get("DepositToAccountRef")),
        "entity_ref":        _ref_name(raw.get("CustomerRef")),
        "memo":              _str(raw.get("PrivateNote") or raw.get("Memo") or ""),
        "category":          "SalesReceipt",
        "currency":          _str(raw.get("CurrencyRef", {}).get("value") or "USD"),
        "is_reconciled":     False,
        "is_deleted":        False,
    }


# ── Dispatch ──────────────────────────────────────────────────────────────────

TRANSACTION_NORMALIZERS = {
    "Payment":       normalize_payment,
    "BillPayment":   normalize_bill_payment,
    "Deposit":       normalize_deposit,
    "Purchase":      normalize_purchase,
    "JournalEntry":  normalize_journal_entry,
    "Transfer":      normalize_transfer,
    "SalesReceipt":  normalize_sales_receipt,
}


def normalize_transaction(entity_id: str, object_type: str, raw: dict) -> Optional[dict]:
    """
    Dispatch to the correct transaction normalizer based on QBO object type.
    Returns None for unknown types.
    """
    fn = TRANSACTION_NORMALIZERS.get(object_type)
    if fn is None:
        log.debug(f"[normalizer] No transaction normalizer for type: {object_type}")
        return None
    try:
        return fn(entity_id, raw)
    except Exception as exc:
        log.warning(
            f"[normalizer] {object_type} qbo_id={raw.get('Id', '?')}: normalize failed: {exc}"
        )
        return None
