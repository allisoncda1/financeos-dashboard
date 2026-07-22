> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# Information Security Policy

**Version:** 0.1-draft  
**Owner:** Allison Fabbri (allison@cardealer.ai)  
**Last Updated:** 2026-07-21  
**Review Frequency:** Annually  

---

## 1. Purpose

This policy establishes the security principles and operational controls governing the FinanceOS financial dashboard system. It exists to protect the confidentiality, integrity, and availability of financial data belonging to the four entities managed within FinanceOS.

## 2. Scope

This policy applies to:

- **System:** FinanceOS Dashboard (Vite+React frontend, Express 5 backend) and FinanceOS Core (Python QBO pipeline)
- **Entities in scope:** T3 Marketing, CarDealer.ai, TopMrktr, Smile More
- **Operator:** Allison Fabbri (sole operator, allison@cardealer.ai)
- **Data:** QuickBooks Online financial data (invoices, bills, transactions, AR/AP, balance sheets) — not consumer PII
- **Infrastructure:** Replit (hosting), Neon PostgreSQL (database), GitHub (source control/CI), Google Cloud Platform (secret management, OIDC)

This policy does **not** claim compliance with SOC 2, ISO 27001, or PCI DSS.

## 3. Policy Owner

**Allison Fabbri** is the designated owner and sole operator of FinanceOS. She is responsible for enforcing this policy, reviewing it annually, and approving any exceptions.

## 4. Operational Security Controls

### 4.1 Authentication

- Passwords are hashed using **bcrypt** (Operational — see `artifacts/api-server/src/auth/service.ts`).
- A **rate limit of 10 requests per 15 minutes** is enforced on the login endpoint to mitigate brute-force attacks.
- **Multi-factor authentication (MFA):** TOTP-based MFA for the FinanceOS application is **in development** and not yet operational. Platform-level MFA (Google, GitHub, Replit, Neon, Intuit) is required but currently unverified — see `docs/security/MFA_VERIFICATION_CHECKLIST.md`.

### 4.2 Session Management

- Session cookies are set with `httpOnly` and `secure` (production) flags.
- Sessions expire after **8 hours** of inactivity.
- Session fixation protection via `session.regenerate()` is **planned** (not yet operational).

### 4.3 Database Access

- The FinanceOS Dashboard connects to Neon PostgreSQL using the **`financeos_dashboard` read-only role**, limiting blast radius in the event of a compromise.
- Write access is reserved for the FinanceOS Core pipeline using the `postgres` role.

### 4.4 Secret Management

- **Replit Secrets:** Admin credentials and database URLs for the Dashboard.
- **GitHub Encrypted Secrets:** QBO credentials and GCP configuration for Core pipeline CI/CD.
- **GCP Secret Manager:** QBO OAuth2 refresh tokens, accessed via **GCP Workload Identity Federation (OIDC)** — no stored service account keys.
- Plaintext secrets must not be stored in source code, committed files, or local dotfiles (`.env` files with real credentials).

### 4.5 Transport Security

- All traffic to the Dashboard is encrypted via **TLS** (managed by Replit).
- Neon PostgreSQL connections enforce **TLS/SSL**.

### 4.6 CI/CD Pipeline Security

- GitHub Actions pipelines authenticate to GCP using **Workload Identity Federation (OIDC)** — no long-lived credentials are stored.
- Workflows are scoped to `contents: read` permissions where possible.

## 5. Planned Controls (Not Yet Operational)

| Control | Status | Notes |
|---|---|---|
| TOTP MFA for FinanceOS application | In development | Branch: security/plaid-production-readiness |
| Session fixation protection | Planned | `session.regenerate()` to be added |
| Automated Dependabot dependency scanning | Being configured | `.github/dependabot.yml` |
| Automated dependency audit workflow | Operational (new) | `.github/workflows/security-audit.yml` |

## 6. Exception Process

Any exception to this policy must be:
1. Documented in writing (a note in the security register or a GitHub issue).
2. Approved by Allison Fabbri.
3. Time-bounded with a remediation deadline.

No exceptions to bcrypt hashing, TLS, or secret management controls are permitted without remediation plan.

## 7. Incident Contact

**Primary contact:** Allison Fabbri — allison@cardealer.ai  
Refer to `docs/security/INCIDENT_RESPONSE_PLAN.md` for detailed response procedures.

## 8. Review

This policy will be reviewed **annually** or following any significant security incident, material infrastructure change, or addition of external users.

---

*Document version: 0.1-draft. Approved version number to be assigned upon approval.*
