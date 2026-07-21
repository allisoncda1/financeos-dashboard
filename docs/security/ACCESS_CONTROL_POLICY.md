> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# Access Control Policy

**Version:** 0.1-draft  
**Owner:** Allison Fabbri (allison@cardealer.ai)  
**Last Updated:** 2026-07-21  
**Review Frequency:** Annually  

---

## 1. Purpose

This policy defines how access to FinanceOS systems, data, and secrets is granted, maintained, and revoked, in accordance with the principle of least privilege.

## 2. Scope

Applies to all human and automated access to:
- FinanceOS Dashboard (Replit-hosted)
- Neon PostgreSQL databases (Core DB and Ops DB)
- GCP Secret Manager
- GitHub repositories
- Replit console and secrets
- QuickBooks Online (via OAuth2)

## 3. Role-Based Access Control (RBAC)

The FinanceOS application defines the following roles. Each role is enforced at the API layer.

| Role | Description | Access Level |
|---|---|---|
| `admin` | Full system access including user management and settings | Read + Write + Admin |
| `cfo` | Cross-entity financial reporting and AR/AP visibility | Read (all entities) |
| `controller` | Entity-level financial operations and reconciliation | Read + limited write (assigned entity) |
| `bookkeeper` | Transaction entry and invoice/bill management | Read + limited write |
| `investor` | Summary financial reporting (no transactional detail) | Read (summary only) |
| `readonly` | View-only access to assigned entity data | Read |

**Current state:** Allison Fabbri is the sole active user with `admin` role. No other users are provisioned.

## 4. Principle of Least Privilege

### 4.1 Database

- **Dashboard application** connects using the **`financeos_dashboard` PostgreSQL role** — this role has `SELECT` privileges only. It cannot `INSERT`, `UPDATE`, `DELETE`, or modify schema.
- **Core pipeline** connects using the `postgres` role for write operations (sync, upsert of financial records). This role is used exclusively in automated CI/CD pipelines, not in interactive sessions.

### 4.2 GCP and CI/CD

- GitHub Actions authenticates to GCP using **Workload Identity Federation (OIDC)**. No service account keys are stored as secrets.
- Permissions are scoped to the minimum required for the pipeline (Secret Manager accessor, not owner).

### 4.3 Application Secrets

- Secrets are stored in dedicated secret managers (Replit Secrets, GitHub Encrypted Secrets, GCP Secret Manager) — not in environment files committed to source control.
- No shared credentials or shared accounts are in use. The system has a single operator.

## 5. Secret Rotation

| Secret | Location | Rotation Trigger |
|---|---|---|
| Admin password (bcrypt hashed) | Replit Secrets | Annually or on suspected compromise |
| QBO OAuth2 refresh tokens | GCP Secret Manager | Per Intuit token expiry policy; also on suspected compromise |
| Neon database URLs/credentials | Replit Secrets + GitHub Encrypted Secrets | On role change or suspected compromise |
| GCP WIF configuration | GitHub Encrypted Secrets | On provider configuration change |

## 6. Privileged Access Review

Allison Fabbri will review the following on an **annual basis** (or upon any personnel change):
- Active application user accounts and their roles
- GitHub repository collaborators and their permissions
- Replit collaborator access
- GCP IAM bindings
- Neon database user roles

**Current review status:** No multi-user access provisioned. Review process to be formalized when additional users are added.

## 7. Multi-Factor Authentication (MFA)

### 7.1 Application MFA — Planned

TOTP-based MFA for the FinanceOS application login is **in development** (branch: `security/plaid-production-readiness`). It is not yet operational.

### 7.2 Platform MFA — Required, Verification Pending

MFA must be enabled on all platform accounts:

| Platform | Account | MFA Status |
|---|---|---|
| Google Account / GCP | allison@cardealer.ai | **Unverified** |
| GitHub | allisoncda1 | **Unverified** |
| Replit | FinanceOS account | **Unverified** |
| Neon Console | Console account | **Unverified** |
| Intuit Developer | Developer account | **Unverified** |

See `docs/security/MFA_VERIFICATION_CHECKLIST.md` for step-by-step verification instructions.

> **Action required:** Platform MFA must be verified and documented before FinanceOS is used for any production-sensitive operations.

## 8. Session Management

- Sessions are cookie-based (`httpOnly`, `secure` in production, `sameSite: lax`).
- Session timeout: **8 hours**.
- Session regeneration on login (fixation protection): **Planned** — `session.regenerate()` to be added in branch `security/plaid-production-readiness`.

## 9. Access Termination

When an operator or user is removed (future scenario):
1. Revoke application account immediately.
2. Rotate any credentials they may have had access to.
3. Review audit logs for the prior 30 days for that account.
4. Update the access review record.

---

*Document version: 0.1-draft. Approved version number to be assigned upon approval.*
