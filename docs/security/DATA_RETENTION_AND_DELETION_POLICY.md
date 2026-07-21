> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# Data Retention and Deletion Policy

**Version:** 0.1-draft  
**Owner:** Allison Fabbri (allison@cardealer.ai)  
**Last Updated:** 2026-07-21  
**Review Frequency:** Annually  

---

## 1. Purpose

This policy defines how long FinanceOS retains data, when and how it is deleted, and what exceptions apply.

## 2. Data Inventory

The following tables and data categories are stored in Neon PostgreSQL:

| Table / Data Type | Description | Database Role |
|---|---|---|
| `invoices` | QBO invoice records per entity | Core DB (write), Ops DB (read) |
| `bills` | QBO vendor bill records per entity | Core DB (write), Ops DB (read) |
| `transactions` | Transaction-level financial data | Core DB (write), Ops DB (read) |
| `qbo_raw` | Raw QBO API response snapshots | Core DB (write) |
| `entity_snapshots` | Point-in-time financial summaries | Core DB (write) |
| `sync_runs` | Pipeline sync run audit records | Core DB (write) |
| Application user accounts | User credentials and role assignments | Ops DB |
| Session data | Active session tokens | Ops DB |

## 3. Retention Periods

| Data Category | Retention Period | Basis |
|---|---|---|
| Financial records (invoices, bills, transactions, entity_snapshots) | **7 years** from transaction date | IRS record-keeping requirements for business financial records |
| Raw QBO API data (`qbo_raw`) | **7 years** | Retained to support audit of imported records |
| Pipeline sync run logs (`sync_runs`) | **2 years** | Operational audit trail |
| Application user accounts | Duration of active use + **1 year** after deactivation | Audit trail requirement |
| Session data | **8 hours** (auto-expired by session store) | Session timeout policy |

## 4. Deletion Process

### 4.1 Current State — Manual Deletion

Automated data deletion jobs are **not yet implemented**. Deletion is currently a manual process performed by the operator (Allison Fabbri) via direct database access.

Steps for manual deletion:
1. Identify records beyond retention period using a date-range query.
2. Confirm no legal hold applies (see Section 6).
3. Execute `DELETE` query via Neon console using the `postgres` role.
4. Record the deletion in the security register (date, table, scope of deletion, performed by).

> **Planned:** An automated retention/deletion job is on the FinanceOS roadmap. This section will be updated when automated deletion is implemented.

### 4.2 Session Data

Session data expires automatically after 8 hours via the session store TTL. No manual intervention is required under normal circumstances.

### 4.3 Application User Account Deletion

When a user account is deactivated:
1. Disable or delete the account in the FinanceOS application.
2. Invalidate all active sessions for that user.
3. Retain the account record for 1 year for audit purposes, then delete.

## 5. Plaid Access Token Revocation (Planned)

**Plaid integration is not yet live.** When implemented, the following process will apply:

When a bank account connection is removed by the operator:
1. Call the Plaid `/item/remove` endpoint to invalidate the access token at Plaid.
2. Delete the encrypted access token from the Neon database immediately.
3. Delete associated bank transaction data per the retention schedule, unless subject to legal hold.
4. Record the revocation event in the audit log.

This section will be updated with implementation details when Plaid is integrated.

## 6. Legal Hold

Records subject to a legal hold must not be deleted, regardless of their scheduled retention period. A legal hold is triggered by:
- Litigation or reasonably anticipated litigation
- Regulatory investigation
- Formal legal request

Legal hold records must be documented (record type, scope, date hold applied, authority). Holds are released by the operator upon written confirmation that the legal matter is resolved.

## 7. Audit Records Retention

Records documenting deletion events (what was deleted, when, by whom) are themselves retained for **7 years** as part of the operational audit trail.

## 8. Exceptions

Any exception to this policy requires written approval from Allison Fabbri and must specify the reason for exception, the data scope, and the alternative disposition.

---

*Document version: 0.1-draft. Approved version number to be assigned upon approval.*
