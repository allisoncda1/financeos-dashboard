> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]
>
> **ACCURACY NOTE (2026-07-21):** Every entry below was verified against actual source code, commit history, and Replit configuration. Claims are separated into "Technical Evidence" (code you can read) and "Operational Evidence" (things that must be confirmed by running the system). MFA code on an unmerged branch is NOT operational evidence. Draft policies are NOT approved policies. Unimplemented Plaid routes are NOT integrated.

# Plaid Production Readiness Matrix

**Date:** 2026-07-21  
**Branch:** `security/plaid-production-readiness` (HEAD: to be updated at commit)  
**Prepared by:** FinanceOS Security Engineering  

---

## Column definitions

- **Honest current answer:** What FinanceOS can truthfully state TODAY to Plaid.
- **Technical evidence:** Code, files, or config that can be verified without running the system.
- **Operational evidence:** Confirmed by running or observing the live system. ❌ = not yet confirmed.
- **Remaining action:** What must happen before the answer changes to Yes.
- **Safe to submit now:** Whether this question can be honestly answered Yes in the questionnaire.

---

## Q1 — Security contact

**Plaid question:** Do you have a designated security contact or team?

| Field | Status |
|---|---|
| Honest current answer | **Partial** |
| Technical evidence | `SECURITY_ROLES_AND_RESPONSIBILITIES.md` defines Allison Fabbri as Security Owner. |
| Operational evidence | ❌ No dedicated security@ email address. No security.txt at /.well-known/security.txt. |
| Remaining action | Establish a dedicated security contact email. Add security.txt. |
| Safe to submit now | **No** — no public security contact established. |

---

## Q2 — Information security policy

**Plaid question:** Do you have a documented, management-approved information security policy?

| Field | Status |
|---|---|
| Honest current answer | **No** |
| Technical evidence | 9 policy documents in `docs/security/`: INFORMATION_SECURITY_POLICY.md, ACCESS_CONTROL_POLICY.md, PRIVACY_POLICY.md, DATA_RETENTION_AND_DELETION_POLICY.md, VULNERABILITY_AND_PATCH_MANAGEMENT_POLICY.md, INCIDENT_RESPONSE_PLAN.md, THIRD_PARTY_AND_VENDOR_SECURITY_POLICY.md, SECURITY_ROLES_AND_RESPONSIBILITIES.md, SECURITY_CONTROL_EVIDENCE_REGISTER.md. All have DRAFT status headers. |
| Operational evidence | ❌ None of the 9 documents have been reviewed or formally approved. All say "Effective date: [PENDING APPROVAL]". |
| Remaining action | Allison must review and formally approve all 9 documents. Set effective dates. |
| Safe to submit now | **No** — draft policies are not approved policies. |

---

## Q3 — Access controls

**Plaid question:** Do you enforce access controls to sensitive data (least privilege, role-based)?

| Field | Status |
|---|---|
| Honest current answer | **Partial** |
| Technical evidence | `src/auth/permissions.ts`: 6 roles (admin, cfo, controller, editor, bookkeeper, readonly) with explicit permission sets. `src/auth/middleware.ts`: requireAuth/requirePermission enforce session and role gates. `src/auth/service.ts`: bcrypt-only password comparison (plaintext throws). `lib/db/src/index.ts`: CORE_DATABASE_URL is read-only from Dashboard. |
| Operational evidence | ❌ MFA not deployed (code on branch, migration not applied). ❌ Platform account MFA status unverified. ❌ `financeos_dashboard` DB role privilege audit not confirmed. |
| Remaining action | Deploy MFA (Steps 1–10 in DEPLOYMENT_RUNBOOK.md). Allison completes MFA_VERIFICATION_CHECKLIST.md. Confirm DB role privileges in Neon. |
| Safe to submit now | **No** — controls exist in code but are not operationally active. |

---

## Q4 — Consumer-facing MFA

**Plaid question:** Do you require multi-factor authentication for end users of your application?

| Field | Status |
|---|---|
| Honest current answer | **No** |
| Technical evidence | `src/auth/mfaRoutes.ts`: TOTP MFA routes implemented (AES-256-GCM secrets, lockout, replay protection, session regeneration). `src/auth/mfaCrypto.ts`: encryption module. `src/auth/mfa.ts`: TOTP generation/verification via speakeasy. 91 security tests pass covering encryption, lockout, replay, recovery codes. Migration `security_001_mfa.sql` ready to apply. |
| Operational evidence | ❌ Migration NOT applied to DATABASE_URL. ❌ TOTP_ENCRYPTION_KEY NOT provisioned in Replit Secrets. ❌ No user is enrolled in MFA. ❌ Application has not been restarted with the new secrets. MFA code on this branch is not merged or deployed. |
| Remaining action | Apply migration. Provision TOTP_ENCRYPTION_KEY. Restart app. Enroll admin. Merge branch. Deploy. |
| Safe to submit now | **No** — MFA is not operationally active. |

---

## Q5 — Critical-system MFA

**Plaid question:** Do you require MFA on critical internal systems (admin consoles, code repositories, cloud infrastructure)?

| Field | Status |
|---|---|
| Honest current answer | **Unknown** |
| Technical evidence | `docs/security/MFA_VERIFICATION_CHECKLIST.md`: step-by-step instructions for verifying MFA on GitHub, Replit, Google/GCP, Neon, Intuit Developer, QBO, Notion, password manager. `docs/security/ACCESS_CONTROL_POLICY.md` (DRAFT) requires MFA on all critical systems. |
| Operational evidence | ❌ Allison has not completed the MFA_VERIFICATION_CHECKLIST.md. Current status of every platform is ❓ (unverified). No platform MFA status has been confirmed by direct observation. |
| Remaining action | Allison must navigate to the security settings of each platform and fill in the checklist. Enable MFA wherever it is off. |
| Safe to submit now | **No** — status is genuinely unknown, not just unconfirmed. Cannot claim Yes. |

---

## Q6 — TLS 1.2+

**Plaid question:** Do you use TLS 1.2 or higher for all data in transit?

| Field | Status |
|---|---|
| Honest current answer | **Yes (inferred)** |
| Technical evidence | `src/app.ts`: `secure: true` cookie flag in production. `app.set("trust proxy", 1)` for Replit's HTTPS reverse proxy. `.replit`: `modules = ["nodejs-24", "python-3.11", "postgresql-16"]` — Replit's platform terminates HTTPS. Neon PostgreSQL requires TLS on all connections. All external API calls (QBO, GCP) use HTTPS endpoints. |
| Operational evidence | ❌ No SSL Labs scan or TLS version report run against deployed URL. Replit's actual TLS configuration not directly verified. |
| Remaining action | Run `ssllabs.com` scan against deployed Replit URL. Capture screenshot as evidence. |
| Safe to submit now | **Conditionally yes** — TLS is enforced by the platform (Replit, Neon). Can state Yes with the caveat that a scan has not been run. Recommend running the scan before submission. |

---

## Q7 — Encryption at rest

**Plaid question:** Do you encrypt sensitive data at rest?

| Field | Status |
|---|---|
| Honest current answer | **Partial** |
| Technical evidence | **Provider-managed (confirmed by documentation):** Neon PostgreSQL encrypts data at rest using AES-256. Replit Secrets are encrypted at rest by Replit. GCP Secret Manager encrypts secrets. GitHub Encrypted Secrets are encrypted. **Application-layer:** `src/auth/mfaCrypto.ts`: AES-256-GCM encryption for TOTP secrets (`totp_secret_encrypted` column). Recovery codes: SHA-256 hashed, never stored plaintext. Admin password: bcrypt. **NOT YET:** Plaid access tokens (`plaid_connections.access_token_encrypted` column defined in migration schema but column and encryption code not connected — routes are stubs). |
| Operational evidence | ❌ MFA migration not applied. ❌ TOTP_ENCRYPTION_KEY not provisioned. ❌ Plaid token encryption not implemented. ❌ Admin password bcrypt status unknown (may be plaintext in Replit Secrets). |
| Remaining action | Apply migrations. Provision TOTP_ENCRYPTION_KEY. Apply safe password hash procedure. Implement Plaid token encryption when Plaid SDK is installed. |
| Safe to submit now | **Partial yes** — provider-managed encryption is real. Application-layer encryption for Plaid access tokens is not yet implemented. Answer should note this distinction. |

---

## Q8 — Vulnerability management

**Plaid question:** Do you have a vulnerability management or patch management program?

| Field | Status |
|---|---|
| Honest current answer | **Partial** |
| Technical evidence | `.github/dependabot.yml`: weekly npm and GitHub Actions dependency updates. `.github/workflows/security-audit.yml`: Monday pnpm audit CI workflow, 90-day artifact retention. `docs/security/VULNERABILITY_AND_PATCH_MANAGEMENT_POLICY.md` (DRAFT): severity SLAs defined. |
| Operational evidence | ❌ Dependabot configuration not yet active (branch not merged). ❌ `pnpm audit` not run — 0 findings not yet confirmed. ❌ Policy not approved. |
| Remaining action | Merge branch to activate Dependabot. Run `pnpm audit` and confirm 0 high/critical. Allison approves vulnerability policy. |
| Safe to submit now | **No** — Dependabot not active; audit not run. |

---

## Q9 — Privacy policy

**Plaid question:** Do you have a published privacy policy that covers bank data collection and use?

| Field | Status |
|---|---|
| Honest current answer | **No** |
| Technical evidence | `docs/security/PRIVACY_POLICY.md` (DRAFT): policy document written covering data collection, use, sharing, retention, deletion, consumer rights. `src/services/consentService.ts`: `CURRENT_PRIVACY_POLICY_VERSION = "privacy-v1.0"`. |
| Operational evidence | ❌ Privacy policy not approved by Allison. ❌ No public URL for the policy. ❌ Not linked in the application. |
| Remaining action | Allison approves the policy. Publish at a public URL (e.g. `https://financeos.repl.co/privacy`). Link from application. |
| Safe to submit now | **No** — Plaid requires a published URL. A draft in a private repo is not a published policy. |

---

## Q10 — Consumer consent

**Plaid question:** Do you obtain explicit consumer consent before linking bank accounts or accessing financial data?

| Field | Status |
|---|---|
| Honest current answer | **No** |
| Technical evidence | `src/services/consentService.ts`: `PLAID_CONSENT_TEXT`, consent text hash, `buildConsentRecord()` defined. `src/routes/plaid.ts`: `POST /plaid/consent` stub route exists. `security_002_consent.sql`: `plaid_consent_records` table schema defined. |
| Operational evidence | ❌ `POST /plaid/consent` is a stub — contains `// TODO:` comments, does NOT persist consent. ❌ Migration not applied. ❌ Plaid Link is not implemented (Plaid SDK not installed). ❌ No consumer-facing consent UI. No real consent is ever recorded. |
| Remaining action | Apply migration. Implement real consent route (replaces stub). Build consent UI. Install Plaid SDK. Implement Link flow. |
| Safe to submit now | **No** — consent infrastructure exists but consent is not actually collected. |

---

## Q11 — Data retention and deletion

**Plaid question:** Do you have a data retention policy and the ability to delete consumer data on request?

| Field | Status |
|---|---|
| Honest current answer | **No** |
| Technical evidence | `docs/security/DATA_RETENTION_AND_DELETION_POLICY.md` (DRAFT): retention periods and deletion procedures documented. `security_002_consent.sql`: `data_deletion_requests` table schema defined. `src/routes/plaid.ts`: `POST /plaid/deletion-request` stub route exists. |
| Operational evidence | ❌ Deletion route is a stub — contains `// TODO:` comments, does NOT perform deletion. ❌ Migration not applied. ❌ No automated deletion job. ❌ Policy not approved. |
| Remaining action | Approve policy. Apply migration. Implement deletion route (remove Plaid item, clear consent records). Build deletion audit trail. |
| Safe to submit now | **No** — deletion is not implemented. |

---

## Honest summary: answers to all 11 questions TODAY

| Q | Question | Honest Answer | Safe to Submit |
|---|---|---|---|
| 1 | Security contact | No dedicated contact | ❌ No |
| 2 | Information security policy | Draft documents, not approved | ❌ No |
| 3 | Access controls | Partial (code exists, not deployed with MFA) | ❌ No |
| 4 | Consumer-facing MFA | No (code on unmerged branch, not deployed) | ❌ No |
| 5 | Critical-system MFA | Unknown (not verified) | ❌ No |
| 6 | TLS 1.2+ | Yes (platform-enforced) | ⚠️ Conditional |
| 7 | Encryption at rest | Provider-managed yes; app-layer partial | ⚠️ Partial |
| 8 | Vulnerability management | Partial (tools exist, not active) | ❌ No |
| 9 | Privacy policy | Draft only, not published | ❌ No |
| 10 | Consumer consent | No (Plaid not integrated) | ❌ No |
| 11 | Data retention/deletion | No (deletion not implemented) | ❌ No |

**Current safe-to-submit count: 0 out of 11 questions (conditionally 1–2 for TLS/encryption).**

---

## Verified facts (source code, 2026-07-21)

| Claim | Evidence location |
|---|---|
| TOTP encryption: AES-256-GCM with unique IV | `src/auth/mfaCrypto.ts:47` — `randomBytes(IV_BYTES)`, `createCipheriv('aes-256-gcm', ...)` |
| Decrypt throws on tampered ciphertext | `src/auth/mfaCrypto.ts:70` — `decipher.final()` throws if auth tag mismatch |
| session.regenerate() after password login | `src/routes/auth.ts:57` — `req.session.regenerate(...)` |
| session.regenerate() after MFA challenge | `src/auth/mfaRoutes.ts` — `req.session.regenerate(...)` in challenge success path |
| Lockout checked before token decryption | `src/auth/mfaRoutes.ts` — `isLockedOut(row)` before `decryptTotpSecret(row...)` in challenge route |
| last_totp_step prevents replay | `src/auth/mfaRoutes.ts` — rejects if `row.last_totp_step >= step` |
| CORS restricted to ALLOWED_ORIGINS in prod | `src/app.ts:104` — origin callback checks allowlist only when `NODE_ENV === 'production'` |
| Plaid routes are stubs | `src/routes/plaid.ts` — all 4 routes have `// TODO:` comments; Plaid SDK not in package.json |
| 871 unit tests pass, 0 fail | `node_modules/.bin/vitest run` — 31 test files, 871 tests |
| Typecheck: 10 pre-existing frontend TS errors | All in `artifacts/financeos/src/App.tsx`, pre-date this security branch |

## Unverified assumptions

| Claim | Why unverified |
|---|---|
| MFA status of any external platform | Allison has not completed MFA_VERIFICATION_CHECKLIST.md |
| FINANCEOS_ADMIN_PASSWORD is bcrypt | Not read from Replit Secrets in this session (cannot view Replit Secrets externally) |
| DATABASE_URL points to Replit built-in PostgreSQL | Documented in code (lib/db/src/index.ts comment + 0001 migration header) but Allison may have overridden with a Replit Secret pointing to an external DB |
| Replit provides TLS 1.2+ | Stated in Replit documentation; not independently scanned |
