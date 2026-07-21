> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri. Effective date: [PENDING APPROVAL]

# Plaid Production Readiness Matrix
**Date:** 2026-07-21  
**Branch:** `security/plaid-production-readiness`  
**Prepared by:** FinanceOS Security Engineering  

---

## Status Legend
- **Verified** — evidence exists in source code or confirmed documentation
- **Implemented but unverified** — code exists; external config not confirmed
- **Planned** — implementation in this branch, not yet deployed
- **Blocked** — requires external action or approval before proceeding
- **Not applicable** — does not apply to FinanceOS's current architecture

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

## Out of Scope / Not Applicable

- **SOC 2 / ISO 27001 / PCI DSS**: FinanceOS does not hold any of these certifications. Do not claim them.
- **Plaid live integration**: Not present. Answer "No" to any question implying live bank data is flowing through Plaid today.
- **Employee device management (MDM)**: Not implemented. Use ENDPOINT_DEVICE_SECURITY_CHECKLIST.md for manual controls.
- **Email/SMS MFA**: No email or SMS infrastructure exists. FinanceOS MFA uses TOTP (authenticator app) only.
