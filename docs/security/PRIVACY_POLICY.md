> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# Privacy Policy

**Version:** 0.1-draft  
**Owner:** Allison Fabbri (allison@cardealer.ai)  
**Last Updated:** 2026-07-21  
**Review Frequency:** Annually or upon material change to data practices  

---

## 1. Purpose

This document describes what data FinanceOS collects, why it collects it, how it is stored and protected, and how it may be deleted. FinanceOS is an internal financial dashboard used exclusively by its operator — it is not a consumer-facing product.

## 2. Who This Policy Applies To

This policy applies to the single operator (Allison Fabbri) and any future internal users of FinanceOS. FinanceOS does not serve or collect data from the general public.

## 3. Data Collected

### 3.1 Financial Data (via QuickBooks Online)

FinanceOS imports financial records from QuickBooks Online for the following entities:
- T3 Marketing
- CarDealer.ai
- TopMrktr
- Smile More

Data imported includes:
- Invoices, estimates, and payments
- Bills and vendor transactions
- Accounts receivable and accounts payable aging data
- Balance sheet snapshots
- Cash flow records
- Sales by customer and product summaries

This data is **business financial records** — it is not consumer personally identifiable information (PII) in the typical sense, though it may include business contact names and company names as part of invoice/billing records.

### 3.2 Application User Data

FinanceOS stores application user accounts for authenticated access. User records include:
- Username / email address
- Bcrypt-hashed password (plaintext password is never stored)
- Role assignment
- Session data (stored in the Neon Ops database)

**Current state:** Only one user account exists (Allison Fabbri, admin).

### 3.3 Audit and Sync Logs

FinanceOS stores pipeline sync run records (`sync_runs` table) including timestamps, entity identifiers, and sync status. These are operational records, not personal data.

## 4. Purpose of Data Collection

All data collected by FinanceOS is used exclusively for:
- Internal financial reporting across the four managed entities
- Accounts receivable and accounts payable monitoring and reconciliation
- Cash flow analysis
- Operational audit trail of data sync runs

FinanceOS does **not** sell, rent, share, or disclose data to any third party for commercial purposes.

## 5. Data Storage

Financial and operational data is stored in **Neon PostgreSQL** (cloud-hosted, encrypted at rest). Access is controlled by role-based database credentials (see `docs/security/ACCESS_CONTROL_POLICY.md`).

Data at rest is encrypted by the Neon platform. Data in transit is protected by TLS.

## 6. Third-Party Data Processors

FinanceOS relies on the following third-party platforms that may process or store data:

| Vendor | Role | Data Processed |
|---|---|---|
| Neon | Database hosting | All FinanceOS stored data |
| Replit | Application hosting | Application traffic, logs |
| Google Cloud Platform | Secret management, OIDC | QBO tokens (Secret Manager) |
| Intuit / QuickBooks Online | Source of financial data | Financial records (API source) |
| Anthropic AI API | AI-assisted features (if used) | Query context provided by operator |
| GitHub | Source control, CI/CD | Source code, workflow logs |

Each vendor is evaluated per `docs/security/THIRD_PARTY_AND_VENDOR_SECURITY_POLICY.md`.

## 7. Future Plaid Integration — Placeholder

FinanceOS plans to add a **Plaid** integration to connect bank accounts and import bank transaction data. **This integration is not yet live.**

When the Plaid integration is implemented, this policy will be updated to disclose:
- What bank connection data is collected via Plaid Link
- How Plaid access tokens are stored and encrypted
- User consent flows for bank account connections
- Plaid access token revocation process

Until Plaid is integrated, no bank account connection data is collected or stored.

## 8. Data Retention

See `docs/security/DATA_RETENTION_AND_DELETION_POLICY.md` for retention periods and deletion procedures.

## 9. Data Deletion

To request deletion of any data stored in FinanceOS:

**Contact:** Allison Fabbri — allison@cardealer.ai

Deletion requests for business financial records may be subject to legal hold requirements (IRS 7-year record retention for financial records). Operational records (session data, sync logs) may be deleted sooner.

## 10. Policy Changes

Material changes to this privacy policy will be documented in the policy version history and communicated to any active users.

---

*Document version: 0.1-draft. Approved version number to be assigned upon approval.*
