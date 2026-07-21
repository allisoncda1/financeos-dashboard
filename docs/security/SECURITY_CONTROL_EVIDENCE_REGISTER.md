> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# Security Control Evidence Register

**Version:** 0.1-draft  
**Owner:** Allison Fabbri (allison@cardealer.ai)  
**Last Updated:** 2026-07-21  
**Review Frequency:** Annually and upon material change  

---

## Status Definitions

| Status | Meaning |
|---|---|
| **Operational** | Control is implemented and actively functioning |
| **Planned** | Control is designed and in active development; not yet live |
| **Unverified** | Control is expected to exist but has not been manually confirmed by the operator |

---

## Control Register

| Control | Category | Status | Evidence Location | Last Verified | Notes |
|---|---|---|---|---|---|
| Bcrypt password hashing | Auth | **Operational** | `artifacts/api-server/src/auth/service.ts:79` | 2026-07-21 | Plain-text fallback being removed |
| Rate limiting on login | Auth | **Operational** | `artifacts/api-server/src/routes/auth.ts:8` | 2026-07-21 | 10 req / 15 min |
| Session httpOnly cookie | Session | **Operational** | `artifacts/api-server/src/app.ts:59` | 2026-07-21 | |
| Session secure in production | Session | **Operational** | `artifacts/api-server/src/app.ts:61` | 2026-07-21 | sameSite: lax |
| Session 8-hour timeout | Session | **Operational** | `artifacts/api-server/src/app.ts:63` | 2026-07-21 | |
| Session fixation protection | Session | **Planned** | Branch: `security/plaid-production-readiness` | 2026-07-21 | `session.regenerate()` being added |
| Neon read-only DB role | DB | **Operational** | `.agents/memory/neon-restricted-dashboard-role.md` | 2026-07-21 | `financeos_dashboard` role; SELECT only |
| GCP Workload Identity Federation | CI/CD | **Operational** | `.github/workflows/` (Core repo) | 2026-07-21 | No stored service account key |
| GitHub Encrypted Secrets | Secret Mgmt | **Operational** | `.github/workflows/` (Core repo) | 2026-07-21 | QBO credentials, DB URLs |
| Replit Secrets | Secret Mgmt | **Operational** | Replit console | 2026-07-21 | Admin password, DB URLs |
| GCP Secret Manager | Secret Mgmt | **Operational** | `automation/secret_manager.py` (Core) | 2026-07-21 | QBO refresh tokens |
| TOTP MFA (application) | Auth | **Planned** | Branch: `security/plaid-production-readiness` | — | Implementation in progress |
| Google Account MFA | Platform | **Unverified** | myaccount.google.com/security | — | Manual verification required — see MFA checklist |
| GitHub Account MFA | Platform | **Unverified** | github.com/settings/security | — | Manual verification required — see MFA checklist |
| Replit Account MFA | Platform | **Unverified** | replit.com/account | — | Manual verification required — see MFA checklist |
| Neon Console MFA | Platform | **Unverified** | console.neon.tech | — | Manual verification required — see MFA checklist |
| Intuit Developer MFA | Platform | **Unverified** | developer.intuit.com | — | Manual verification required — see MFA checklist |
| TLS (Replit) | Transport | **Operational** | Replit platform — auto TLS | 2026-07-21 | Provider-managed; no operator action required |
| TLS (Neon) | Transport | **Operational** | Neon — TLS required on connections | 2026-07-21 | SSL enforced on database connections |
| Dependabot alerts | Vuln Mgmt | **Planned** | `.github/dependabot.yml` | — | Being configured; not yet active |
| Scheduled dependency audit | Vuln Mgmt | **Operational** | `.github/workflows/security-audit.yml` | 2026-07-21 | Weekly Monday 9am UTC; pnpm audit --audit-level=high |
| Secret scanning (GitHub) | Vuln Mgmt | **Unverified** | GitHub repo settings → Security | — | Manual verification required |
| Endpoint: FileVault | Endpoint | **Unverified** | macOS System Preferences → Privacy & Security → FileVault | — | Manual verification — see Endpoint checklist |
| Endpoint: Screen lock | Endpoint | **Unverified** | macOS System Preferences → Lock Screen | — | Manual verification — see Endpoint checklist |
| Endpoint: macOS security updates | Endpoint | **Unverified** | macOS System Preferences → General → Software Update | — | Manual verification — see Endpoint checklist |

---

## Verification Log

Record manual verification events here as controls are confirmed:

| Date | Control | Verified By | Method | Result |
|---|---|---|---|---|
| 2026-07-21 | Bcrypt password hashing | Allison Fabbri | Code review | Confirmed at `auth/service.ts:79` |
| 2026-07-21 | Rate limiting on login | Allison Fabbri | Code review | Confirmed at `routes/auth.ts:8` |
| 2026-07-21 | Session configuration | Allison Fabbri | Code review | httpOnly, secure, sameSite:lax, 8h TTL confirmed at `app.ts:59-63` |
| 2026-07-21 | Neon read-only role | Allison Fabbri | Memory/config review | `financeos_dashboard` role documented |
| 2026-07-21 | GCP WIF | Allison Fabbri | Workflow review | No stored service account key confirmed |

---

*Document version: 0.1-draft. Approved version number to be assigned upon approval.*
