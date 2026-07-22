> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# Third-Party and Vendor Security Policy

**Version:** 0.1-draft  
**Owner:** Allison Fabbri (allison@cardealer.ai)  
**Last Updated:** 2026-07-21  
**Review Frequency:** Annually  

---

## 1. Purpose

This policy defines how FinanceOS evaluates, manages, and monitors the security posture of third-party vendors that handle or have access to FinanceOS systems or data.

## 2. Scope

Applies to all vendors, platforms, and APIs that:
- Store or process FinanceOS data
- Provide infrastructure FinanceOS runs on
- Authenticate to FinanceOS or grant FinanceOS authentication to other systems

## 3. Vendor Assessment Criteria

Before adding a new vendor, the following must be assessed:

| Criterion | Minimum Requirement |
|---|---|
| Transport security | TLS 1.2 or higher required on all connections |
| Encryption at rest | Data at rest must be encrypted by the vendor |
| MFA availability | Vendor must support MFA for console/admin access |
| Security incident history | No unresolved material breaches in the prior 12 months (public record) |
| Access control | Vendor must support role-based or credential-scoped access |
| Data processing agreement | Vendor must have published terms covering data handling |

## 4. Current Vendor Register

### 4.1 Replit

| Attribute | Detail |
|---|---|
| **Role** | Application hosting for FinanceOS Dashboard |
| **Data processed** | Application traffic, logs, Replit Secrets (admin password, DB URLs) |
| **TLS** | Yes — automatic TLS managed by Replit |
| **Encryption at rest** | Per Replit platform (not independently verified) |
| **MFA available** | Yes — must be enabled on Allison's Replit account (currently **Unverified**) |
| **API/token management** | Replit Secrets — scoped to the repl |
| **Security posture notes** | Platform-managed hosting; operator has no control over underlying infra patching |

### 4.2 Neon PostgreSQL

| Attribute | Detail |
|---|---|
| **Role** | Cloud PostgreSQL hosting for Core DB and Ops DB |
| **Data processed** | All FinanceOS financial data (invoices, bills, transactions, snapshots, sessions) |
| **TLS** | Yes — SSL enforced on all connections |
| **Encryption at rest** | Yes — Neon encrypts data at rest |
| **MFA available** | Yes — must be enabled on console account (currently **Unverified**) |
| **API/token management** | Database credentials stored in Replit Secrets and GitHub Encrypted Secrets |
| **Security posture notes** | Read-only role (`financeos_dashboard`) used by Dashboard; write role used only by Core pipeline |

### 4.3 GitHub

| Attribute | Detail |
|---|---|
| **Role** | Source control and CI/CD (GitHub Actions) |
| **Data processed** | Source code, workflow logs, GitHub Encrypted Secrets (QBO credentials, GCP WIF config) |
| **TLS** | Yes |
| **Encryption at rest** | Yes — GitHub encrypts secrets and data at rest |
| **MFA available** | Yes — must be enabled on allisoncda1 account (currently **Unverified**) |
| **API/token management** | GitHub Encrypted Secrets; Workload Identity Federation (no stored service account keys) |
| **Security posture notes** | Secret scanning and Dependabot to be configured; branch protection policies recommended |

### 4.4 Google Cloud Platform (GCP)

| Attribute | Detail |
|---|---|
| **Role** | Secret Manager for QBO refresh tokens; Workload Identity Federation for OIDC |
| **Data processed** | QBO OAuth2 refresh tokens; OIDC token exchange |
| **TLS** | Yes |
| **Encryption at rest** | Yes — GCP encrypts Secret Manager data at rest |
| **MFA available** | Yes — must be enabled on Google account (currently **Unverified**) |
| **API/token management** | WIF OIDC — no stored service account keys; refresh tokens in Secret Manager |
| **Security posture notes** | IAM permissions scoped to Secret Manager accessor role for pipeline |

### 4.5 Intuit / QuickBooks Online

| Attribute | Detail |
|---|---|
| **Role** | Source of financial data via QBO API (OAuth2) |
| **Data processed** | OAuth2 refresh token exchange; all QBO financial data returned by API |
| **TLS** | Yes — Intuit API requires TLS 1.2+ |
| **Encryption at rest** | Per Intuit platform |
| **MFA available** | Yes — must be enabled on Intuit Developer account and QBO company admins (currently **Unverified**) |
| **API/token management** | Refresh tokens stored in GCP Secret Manager; rotated per Intuit token expiry policy |
| **Security posture notes** | OAuth2 scopes should be limited to minimum required; token rotation documented in IRP |

### 4.6 Anthropic AI API

| Attribute | Detail |
|---|---|
| **Role** | AI-assisted features (if/when used in FinanceOS) |
| **Data processed** | Query context provided by the operator; may include financial summaries |
| **TLS** | Yes |
| **Encryption at rest** | Per Anthropic platform |
| **MFA available** | Yes — on console.anthropic.com |
| **API/token management** | API key — must be stored in Replit Secrets or GitHub Encrypted Secrets, never in code |
| **Security posture notes** | Do not send raw financial records (full datasets) to the API; limit to summary context. Review Anthropic usage policy for business data. |

## 5. Future Vendor: Plaid

**Status: Not yet integrated**

Plaid will be added as a vendor when the bank connection feature is implemented. Prior to integration:

- Review Plaid's security documentation and data processing terms.
- Ensure Plaid access tokens are encrypted at rest in Neon.
- Implement `item/remove` endpoint for access token revocation.
- Update this policy and `docs/security/PRIVACY_POLICY.md` before go-live.

Plaid minimum requirements: same as Section 3 plus bank-grade access token management and audit logging.

## 6. API Key and Token Management

For all vendors:
- API keys and tokens must be stored in an approved secret store (Replit Secrets, GitHub Encrypted Secrets, or GCP Secret Manager).
- Keys must never be hardcoded in source files or committed to git.
- Keys must be rotated on any suspected compromise or when a vendor reports a security incident.
- Unused vendor integrations must have their keys revoked.

## 7. Vendor Security Review

Vendors are reviewed annually (or when a material change occurs — new data scope, vendor acquisition, published breach):
1. Verify MFA is enabled on the vendor console account.
2. Review any published security incidents in the prior 12 months.
3. Confirm the vendor's encryption and TLS posture has not degraded.
4. Update this register with the review date.

---

*Document version: 0.1-draft. Approved version number to be assigned upon approval.*
