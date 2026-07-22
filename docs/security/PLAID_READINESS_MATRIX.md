> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]
>
> **ACCURACY NOTE:** This is an honest gap analysis verified against source code on 2026-07-21. Do not submit to Plaid until all blockers in the gap list are resolved.

# Plaid Production Readiness Matrix
**Date:** 2026-07-21  
**Branch:** `security/plaid-production-readiness`  
**Prepared by:** FinanceOS Security Engineering  

---

## Status Legend
- ✅ **Implemented** — code exists, tested, deployable
- ⚠️ **Partial** — foundation exists; gaps listed; must close before Plaid approval
- ❌ **Not implemented** — nothing exists; must be built before submission
- 📋 **Action pending** — requires Allison's manual action (not a code change)

---

## Plaid Security Questionnaire Matrix

| # | Question | Current Answer | Target Answer | Control Required | Evidence | Status | Remaining Action |
|---|---|---|---|---|---|---|---|
| 1 | Do you have a documented information security program? | No | Yes | 9 policy documents in `docs/security/` | docs/security/INFORMATION_SECURITY_POLICY.md et al. | Planned | Allison must review and formally approve all 9 documents |
| 2 | Do you enforce access controls to customer data (least privilege, role-based)? | Partial | Yes | RBAC (6 roles), read-only DB role for Dashboard, bcrypt auth, session management | auth/permissions.ts, neon-restricted-dashboard-role.md, auth/service.ts | Implemented but unverified | Verify Allison's platform accounts have MFA (see MFA_VERIFICATION_CHECKLIST.md) |
| 3 | Do you require MFA for consumers/end users of your application? | No | Yes | TOTP MFA + passkey option, MFA required before Plaid Link | auth/mfa.ts, auth/mfaRoutes.ts (this branch) | Planned | Deploy MFA (migration + Replit Secrets migration + enable in prod) — requires Allison approval |
| 4 | Do you require MFA on critical internal systems (admin consoles, code repos, cloud infra)? | Unverified | Yes | GitHub, Google, Replit, Neon, Intuit — MFA enabled for Allison | See MFA_VERIFICATION_CHECKLIST.md | Blocked | Allison must complete MFA_VERIFICATION_CHECKLIST.md and confirm all 5 platform accounts |
| 5 | Do you use TLS 1.2+ for all data in transit? | Yes (inferred) | Yes | Replit auto-TLS, Neon TLS-required, all external APIs use HTTPS | TLS_AND_ENCRYPTION_EVIDENCE.md | Implemented but unverified | Confirm TLS version via Replit's documentation or SSL Labs scan of deployed URL |
| 6 | Do you encrypt sensitive data at rest? | Yes (provider-managed) | Yes | Neon: AES-256 at rest; Replit Secrets: encrypted; GCP Secret Manager: encrypted; GitHub Secrets: encrypted | TLS_AND_ENCRYPTION_EVIDENCE.md | Implemented but unverified | App-layer encryption for TOTP secrets and future Plaid tokens pending MFA deployment |
| 7 | Do you have a vulnerability management program? | Partial | Yes | Dependabot configuration, pip-audit CI workflow, severity SLAs | .github/dependabot.yml, .github/workflows/security-audit.yml | Planned | Merge dependabot config; run first audit; document remediation SLAs |
| 8 | Do you have a privacy policy? | No (published) | Yes | Privacy policy document created | docs/security/PRIVACY_POLICY.md | Planned | Allison must approve and publish privacy policy at a public URL |
| 9 | Do you obtain explicit consumer consent before accessing bank data? | No (Plaid not integrated) | Yes | Consent gate route + consent records table + consent UI | routes/plaid.ts, services/consentService.ts, security_002_consent.sql | Planned | Apply consent migration; build consent UI; test consent gate before Plaid Link |
| 10 | Do you have a data retention and deletion policy? | No | Yes | Data retention policy document + deletion request endpoint | docs/security/DATA_RETENTION_AND_DELETION_POLICY.md, routes/plaid.ts DELETE endpoint | Planned | Allison must approve policy; implement automated deletion job (future sprint) |
| 11 | (Additional) Do you have an incident response plan? | No | Yes | Incident response plan document | docs/security/INCIDENT_RESPONSE_PLAN.md | Planned | Allison must review and approve IRP |

---

## Questions Now Answerable as "Yes" (with current branch merged and deployed)

| Question | Basis |
|---|---|
| Q1 — Information security program | 9 policy documents created, approved by Allison |
| Q5 — TLS 1.2+ | Replit auto-TLS + Neon TLS + all APIs use HTTPS |
| Q6 — Encryption at rest | Provider-managed (Neon, Replit Secrets, GCP Secret Manager, GitHub Secrets) |

## Questions Requiring "No" or Deployment Before "Yes"

| Question | Gap | Required Before "Yes" |
|---|---|---|
| Q2 — Access controls | Platform MFA unverified | Allison completes MFA checklist |
| Q3 — Consumer MFA | TOTP implemented but not deployed | Migration applied, deployed, tested |
| Q4 — Critical system MFA | All platform accounts unverified | Allison verifies/enables MFA on all 5 platforms |
| Q7 — Vulnerability management | Dependabot not yet active | Merge + first audit run |
| Q8 — Privacy policy | Document exists but not published | Public URL required |
| Q9 — Consumer consent | Route exists; UI + migration pending | Apply migration; build UI; test |
| Q10 — Data retention/deletion | Policy written; deletion job not built | Allison approves; build deletion automation |

---

## Actions Awaiting Allison's Approval

| # | Action | Risk if Skipped |
|---|---|---|
| A1 | Enable MFA on Google Account (myaccount.google.com) | Platform compromise → all GCP/Secret Manager access |
| A2 | Enable MFA on GitHub account (allisoncda1) | Code/secrets compromise |
| A3 | Enable MFA on Replit account | Production environment compromise |
| A4 | Enable MFA on Neon console | Database admin access |
| A5 | Enable MFA on Intuit Developer | QBO API credential exposure |
| A6 | Approve and apply security_001_mfa.sql migration | App-layer MFA cannot be deployed |
| A7 | Approve and apply security_002_consent.sql migration | Consent records cannot be persisted |
| A8 | Migrate FINANCEOS_ADMIN_PASSWORD to bcrypt hash in Replit Secrets | Plaintext fallback path remains active |
| A9 | Review and approve all 9 security policy documents | Cannot answer Q1 honestly |
| A10 | Publish Privacy Policy at a public URL | Cannot answer Q8 honestly |
| A11 | Rotate GitHub PAT in qbo_extract remote if confirmed (see SECRET_SCAN_REPORT.md) | Leaked credential |
| A12 | Merge and deploy security/plaid-production-readiness PR after review | None of Phase 2/3/4/5 controls become active |

---

## CRITICAL: Verified vs. Claimed

### Verified by direct code inspection (2026-07-21)

| Claim | File | Line / Evidence |
|---|---|---|
| TOTP encryption uses AES-256-GCM with unique IV | `src/auth/mfaCrypto.ts` | `crypto.createCipheriv('aes-256-gcm', ...)` with `crypto.randomBytes(16)` IV |
| `session.regenerate()` after password auth | `src/routes/auth.ts` | After bcrypt verify, before MFA check |
| `session.regenerate()` after MFA challenge | `src/auth/mfaRoutes.ts` | In `POST /challenge` on success |
| Lockout checked before challenge attempt | `src/auth/mfaRoutes.ts` | `isLockedOut(row)` before any token check |
| Lockout set after 5 failures | `src/auth/mfaRoutes.ts` | `MAX_FAILED_CHALLENGES = 5`, sets `locked_until` |
| Replay protection via `last_totp_step` | `src/auth/mfaRoutes.ts` | Rejects if `row.last_totp_step >= step` |
| CORS restricted by `ALLOWED_ORIGINS` in production | `src/app.ts` | Origin callback checks allowlist only in NODE_ENV=production |
| Plaintext password throws, not silently accepted | `src/auth/service.ts` | `passwordMatches()` throws if no bcrypt prefix |
| Plaid routes are stubs (TODO) | `src/routes/plaid.ts` | All 4 routes have `// TODO:` comments; no Plaid SDK imported |

### Not verified (requires Allison action or external check)

| Claim | Status |
|---|---|
| `FINANCEOS_ADMIN_PASSWORD` is a bcrypt hash in Replit Secrets | **Unknown** — must check |
| `TOTP_ENCRYPTION_KEY` is provisioned in Replit Secrets | **Unknown** — must check |
| `ALLOWED_ORIGINS` is set in Replit Secrets for production | **Unknown** — must check |
| MFA enabled on GitHub, Replit, Neon, GCP, email | **Unknown** — see MFA_VERIFICATION_CHECKLIST.md |
| Plaid developer account exists or is pending | **Unknown** |

---

## Blockers — Must Resolve Before Plaid Submission

1. **Plaid SDK not installed.** `src/routes/plaid.ts` routes are stubs. No Link flow, token exchange, or webhook verification implemented.
2. **Plaid access token encryption not implemented.** Schema column exists; encryption code does not.
3. **Migrations not applied.** `security_001_mfa.sql` and `security_002_consent.sql` must run against `DATABASE_URL` Neon DB.
4. **`TOTP_ENCRYPTION_KEY` not provisioned.** MFA enrollment throws at startup without it.
5. **Consent recording not functional.** `POST /plaid/consent` is a stub.
6. **Privacy Policy not published** at a public URL.
7. **Admin password bcrypt status unknown.** Apply safe hash procedure (`SAFE_PASSWORD_HASH_PROCEDURE.md`).
8. **Platform MFA status unverified.** Allison must complete `MFA_VERIFICATION_CHECKLIST.md`.
9. **Policy documents not approved.** All 9 policies are DRAFT; Allison must formally approve.

---

## Out of Scope / Not Applicable

- **SOC 2 / ISO 27001 / PCI DSS**: FinanceOS does not hold any of these certifications. Do not claim them.
- **Plaid live integration**: Not present. Answer "No" to any question implying live bank data flows through Plaid today.
- **Employee device management (MDM)**: Not implemented. Use ENDPOINT_DEVICE_SECURITY_CHECKLIST.md for manual controls.
- **Email/SMS MFA**: No email or SMS infrastructure. FinanceOS MFA uses TOTP (authenticator app) only.
