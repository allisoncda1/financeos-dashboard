"""
FinanceOS Core Sync Engine
--------------------------
Connects the existing Python FinanceOS pipeline to the PostgreSQL Core Database.

Phase 2 objective: QuickBooks → PostgreSQL (raw + normalized tables).
Nothing in this package modifies the existing pipeline, dashboard, or exports.

Entry point:
    python3 -m financeos_core.sync.runner [full_backfill | incremental | manual]

Reuses without modification:
    connectors.quickbooks  — QBO API connector (auth, query, reports)
    extraction.extract_raw — extraction logic reference (new sync calls QBO directly)
"""
