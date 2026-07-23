> **UPDATED 2026-07-22.** This matrix was last updated to reflect the squash-merge of `security/plaid-production-readiness` (4289ebf) into main and the platform MFA verification completed by Allison Fabbri on 2026-07-22.
>
> **ACCURACY NOTE:** Every entry is verified against actual source code, commit history, and operator-confirmed evidence. Claims are separated into "Technical Evidence" (code you can read) and "Operational Evidence" (things confirmed by running or observing the live system). ❌ = not yet confirmed; ✅ = confirmed.

# Plaid Production Readiness Matrix

**Date:** 2026-07-22 (updated)  
**Branch:** `security/plaid-questionnaire-readiness`  
**Prepared by:** FinanceOS Security Engineering

---

## Column definitions

- **Honest current answer:** What FinanceOS can truthfully state TODAY to Plaid.
- **Technical evidence:** Code, files, or config that can be verified without running the system.
- **Operational evidence:** Confirmed by running or observing the live system. ❌ = not yet confirmed; ✅ = confirmed.
- **Remaining action:** What must happen before the answer changes to Yes.
- **Safe to submit now:** Whether this question can be honestly answered Yes in the questionnaire.

---

## Q1 — Security contact

**Plaid question:** Do you have a designated security contact or team?

| Field | Status |
|---|---|
| Honest current answer | **Yes** |
| Technical evidence | `SECURITY_ROLES_AND_RESPONSIBILITIES.md`: Security Owner = Allison Fabbri, Controller & FinanceOS Project Lead, `allison@cardealer.ai`. All security responsibilities assigned to this contact. |
| Operational evidence | ✅ allison@cardealer.ai is an active business email. No separate `security@` alias, but Plaid does not require one. |
| Remaining action | None. |
| Safe to submit now | **Yes** — Allison Fabbri, allison@cardealer.ai. |

---

## Q2 — Information security policy

**Plaid question:** Do you have a documented, management-approved information security policy?

| Field | Status |
|---|---|
| Honest current answer | **Partial** |
| Technical evidence | 9 policy documents in `docs/security/`: INFORMATION_SECURITY_POLICY.md, ACCESS_CONTROL_POLICY.md, PRIVACY_POLICY.md (approved 2026-07-22), DATA_RETENTION_AND_DELETION_POLICY.md, VULNERABILITY_AND_PATCH_MANAGEMENT_POLICY.md (approved 2026-07-22), INCIDENT_RESPONSE_PLAN.md, THIRD_PARTY_AND_VENDOR_SECURITY_POLICY.md, SECURITY_ROLES_AND_RESPONSIBILITIES.md, SECURITY_CONTROL_EVIDENCE_REGISTER.md (approved 2026-07-22). |
| Operational evidence | ✅ PRIVACY_POLICY.md approved 2026-07-22. ✅ VULNERABILITY_AND_PATCH_MANAGEMENT_POLICY.md approved 2026-07-22. ✅ SECURITY_CONTROL_EVIDENCE_REGISTER.md approved 2026-07-22. ❌ Remaining 6 policies (INFORMATION_SECURITY_POLICY, ACCESS_CONTROL_POLICY, DATA_RETENTION_AND_DELETION_POLICY, INCIDENT_RESPONSE_PLAN, THIRD_PARTY_AND_VENDOR_SECURITY_POLICY, SECURITY_ROLES_AND_RESPONSIBILITIES) still in DRAFT. |
| Remaining action | Allison reviews and formally approves the remaining 6 policy documents. |
| Safe to submit now | **Partial yes** — 3 policies are approved. Core policy suite not fully approved yet. |

---

## Q3 — Access controls

**Plaid question:** Do you enforce access controls to sensitive data (least privilege, role-based)?

| Field | Status |
|---|---|
| Honest current answer | **Yes** |
| Technical evidence | **RBAC:** `src/auth/permissions.ts`: 6 roles (admin, cfo, controller, editor, bookkeeper, readonly), each with an explicit permission set. **Session enforcement:** `src/auth/middleware.ts`: `requireAuth` checks active session; `requirePermission` checks role. **Password security:** bcrypt cost-12, no plaintext comparison. **MFA enforcement:** `requireMfa` middleware enforces TOTP verification before protected routes. **Database separation:** `CORE_DATABASE_URL` read-only; writes go only to `DATABASE_URL`. **Secret storage:** Replit Secrets for all credentials (not hardcoded). |
| Operational evidence | ✅ MFA merged and deployed (4289ebf + PR #29). ✅ Platform MFA verified by Allison 2026-07-22. ✅ Neon `financeos_dashboard` role is read-only. ✅ Admin password confirmed as bcrypt hash in Replit Secrets. |
| Remaining action | None for access controls. |
| Safe to submit now | **Yes** — RBAC, session enforcement, bcrypt, DB separation, and MFA all confirmed operational. |

---

## Q4 — Consumer-facing MFA

**Plaid question:** Do you require multi-factor authentication for end users of your application?

| Field | Status |
|---|---|
| Honest current answer | **Yes** |
| Technical evidence | `src/auth/mfaRoutes.ts`: TOTP MFA routes — enrollment, challenge, recovery codes (10 codes, SHA-256 hashed). `src/auth/mfaCrypto.ts`: AES-256-GCM encryption for TOTP secrets. `src/auth/mfa.ts`: TOTP via speakeasy. `src/pages/mfa-setup.tsx`, `src/pages/mfa-challenge.tsx`: enrollment and challenge UI. `requireMfa` middleware: blocks protected routes until MFA challenge succeeds. Merged in squash commit 4289ebf and PR #29. |
| Operational evidence | ✅ MFA merged to main (4289ebf, 2026-07-22). ✅ MFA verified by Allison across FinanceOS application and all critical external platforms. ✅ Migration security_001_mfa.sql applied. ✅ TOTP_ENCRYPTION_KEY provisioned in Replit Secrets. |
| Remaining action | None — MFA is operationally active. |
| Safe to submit now | **Yes** — TOTP MFA required for all FinanceOS users. Internal-only platform; one authorized operator. |

---

## Q5 — Critical-system MFA

**Plaid question:** Do you require MFA on critical internal systems (admin consoles, code repositories, cloud infrastructure)?

| Field | Status |
|---|---|
| Honest current answer | **Yes** |
| Technical evidence | `docs/security/MFA_VERIFICATION_CHECKLIST.md`: step-by-step checklist for GitHub, Replit, Google/GCP, Neon, Intuit Developer. `docs/security/ACCESS_CONTROL_POLICY.md` (DRAFT) requires MFA on all critical systems. |
| Operational evidence | ✅ Google Account MFA: verified 2026-07-22. ✅ GitHub Account MFA: verified 2026-07-22. ✅ Replit Account MFA: verified 2026-07-22. ✅ Neon Console MFA: verified 2026-07-22. ✅ Intuit Developer MFA: verified 2026-07-22. All verifications by Allison Fabbri. |
| Remaining action | None — all critical-system MFA verified. |
| Safe to submit now | **Yes** — MFA active on all critical systems. |

---

## Q6 — TLS 1.2+

**Plaid question:** Do you use TLS 1.2 or higher for all data in transit?

| Field | Status |
|---|---|
| Honest current answer | **Yes (inferred)** |
| Technical evidence | `src/app.ts`: `secure: true` cookie flag in production. `app.set("trust proxy", 1)` for Replit's HTTPS reverse proxy. Replit terminates HTTPS/TLS. Neon PostgreSQL requires TLS on all connections. All external API calls (QBO, GCP) use HTTPS endpoints. |
| Operational evidence | ❌ No SSL Labs scan run against deployed URL. Must verify before submission with: `curl -sI https://<deployed-url> \| grep -i "strict-transport\|server"` |
| Remaining action | Run TLS verification command against the stable deployed URL before submitting. |
| Safe to submit now | **Conditionally yes** — TLS is enforced by the platform. Run verification command before final submission. |

---

## Q7 — Encryption at rest

**Plaid question:** Do you encrypt sensitive data at rest?

| Field | Status |
|---|---|
| Honest current answer | **Partial** |
| Technical evidence | **Layer 1 — Provider-managed (confirmed):** Neon AES-256, Replit Secrets, GCP Secret Manager, GitHub Encrypted Secrets. **Layer 2 — Application-layer TOTP secrets:** `src/auth/mfaCrypto.ts`: AES-256-GCM, unique IV per secret, `totp_secret_encrypted TEXT`. **Layer 3 — Passwords and recovery codes:** bcrypt cost-12 for admin password; SHA-256 hashed recovery codes. **Layer 4 — Plaid access tokens:** `plaid_connections.access_token_encrypted TEXT` column defined in schema; encryption implementation NOT YET WRITTEN. Plaid SDK not installed. |
| Operational evidence | ✅ MFA migration applied; TOTP encryption active. ✅ Admin password bcrypt confirmed in Replit Secrets. ❌ Plaid access token encryption not implemented (no Plaid integration yet). |
| Remaining action | Implement Plaid access token encryption when Plaid SDK is installed. Provider-managed and TOTP encryption are operational. |
| Safe to submit now | **Partial yes** — provider-managed encryption is real and operational. Application-layer Plaid token encryption not yet implemented. State this distinction accurately. |

---

## Q8 — Vulnerability management

**Plaid question:** Do you have a vulnerability management or patch management program?

| Field | Status |
|---|---|
| Honest current answer | **Yes** |
| Technical evidence | `.github/dependabot.yml`: active on main (squash commit 4289ebf, 2026-07-22); weekly npm and GitHub Actions scans, security grouping, `security`/`dependencies` labels. `.github/workflows/security-audit.yml`: Monday 9am UTC `pnpm audit --audit-level=high`, 90-day artifact retention. `package.json` `security:vulnerability-check` script: runs production audit and full audit with severity separation. `docs/security/VULNERABILITY_AND_PATCH_MANAGEMENT_POLICY.md`: approved 2026-07-22; severity SLAs (Critical: 7 days, High: 30 days, Medium: 90 days, Low: next maintenance). Weekly review process documented. Exception process documented. |
| Operational evidence | ✅ Dependabot active on main branch as of 2026-07-22. ✅ Security audit workflow active (weekly CI). ✅ Manual vulnerability check command: `pnpm run security:vulnerability-check`. ✅ Policy approved by Allison Fabbri 2026-07-22. ⚠️ **Latest `pnpm audit --prod` result (2026-07-22): 3 findings — 2 high, 1 moderate. All are transitive dependencies; none are direct.** See details below. |
| Remaining action | (1) Resolve the 3 production audit findings within SLA: brace-expansion high → 30 days (by 2026-08-21), uuid moderate → 90 days. (2) Verify GitHub secret scanning is enabled in repo settings. (3) Dependabot will automatically open PRs for these — review and merge within SLA window. |
| Safe to submit now | **Yes, with documented findings** — Program is operational and findings are documented with a remediation plan. Honest answer: "Yes — Dependabot active, weekly CI audit, manual vulnerability check, approved policy with severity SLAs (Critical 7 days, High 30 days, Medium 90 days). Audit run 2026-07-22 found 3 transitive dependency advisories (2 high: brace-expansion DoS via exceljs/archiver; 1 moderate: uuid bounds check via @google-cloud/storage). Compensating control: FinanceOS is an internal-only platform with no external user inputs reaching these code paths, significantly reducing exploitability. Patches tracked; remediation within 30-day High SLA (by 2026-08-21)." |

**Production audit findings (run 2026-07-22):**

| Severity | Package | Advisory | Path | SLA deadline | Compensating control |
|---|---|---|---|---|---|
| High | brace-expansion ≥2.0.0 <2.1.2 | GHSA-3jxr-9vmj-r5cp: DoS via exponential brace expansion | `api-server→exceljs→archiver→readdir-glob→minimatch→brace-expansion` | 2026-08-21 | Internal-only; no external input reaches this path; DoS requires crafted input |
| High | brace-expansion <1.1.16 | GHSA-3jxr-9vmj-r5cp | `api-server→exceljs→archiver→archiver-zip-encrypted→minimatch→brace-expansion` | 2026-08-21 | Same as above |
| Moderate | uuid <11.1.1 | GHSA-w5hq-g745-h8pq: Missing buffer bounds check in v3/v5/v6 | `api-server→@google-cloud/storage→gaxios→uuid` | 2026-10-21 | No external user-controlled UUID generation |

---

## Q9 — Privacy policy

**Plaid question:** Do you have a published privacy policy that covers bank data collection and use?

| Field | Status |
|---|---|
| Honest current answer | **Technically yes — stable URL pending** |
| Technical evidence | `docs/security/PRIVACY_POLICY.md`: approved 2026-07-22; covers data collection, Plaid planned use, consent, retention, deletion, security controls, contact. `artifacts/financeos/src/pages/privacy.tsx`: full policy rendered as a React page. `artifacts/financeos/src/App.tsx`: `/privacy` route is public (no `ProtectedRoute` wrapper). |
| Operational evidence | ✅ Policy approved by Allison Fabbri (effective 2026-07-22). ✅ `/privacy` route is public — no login required. ✅ Policy accessible at dev URL: `https://f2131a9f-1943-4611-9f2c-efe4f28a76cb-00-2l4nfeksnyk44.kirk.replit.dev/privacy` (note: dev URLs are temporary and will change). ❌ Stable public URL not yet established. Requires Replit deployment to a stable URL (publishing the app). |
| Remaining action | Publish/deploy the FinanceOS app to a stable Replit URL. Provide that URL to Plaid (format: `https://<stable-url>/privacy`). |
| Safe to submit now | **Not yet — blocked on stable URL only.** The policy content, approval, and public route are all complete. The single remaining blocker is obtaining a stable deployed URL. Once the app is deployed at a stable Replit URL, Q9 is ready to submit. |

---

## Q10 — Consumer consent

**Plaid question:** Do you obtain explicit consumer consent before linking bank accounts or accessing financial data?

| Field | Status |
|---|---|
| Honest current answer | **No** |
| Technical evidence | `src/services/consentService.ts`: `PLAID_CONSENT_TEXT`, consent hash, `buildConsentRecord()` defined. `src/routes/plaid.ts`: `POST /plaid/consent` stub route. `security_002_consent.sql`: `plaid_consent_records` table schema. |
| Operational evidence | ❌ Consent route is a stub (`// TODO:`). ❌ Plaid Link not implemented. ❌ No consent UI. ❌ No real consent is recorded. |
| Remaining action | Install Plaid SDK. Build Plaid Link flow. Implement real consent route. Build consent UI. |
| Safe to submit now | **No** — consent infrastructure exists but consent is not collected because Plaid is not integrated. |

---

## Q11 — Data retention and deletion

**Plaid question:** Do you have a data retention policy and the ability to delete consumer data on request?

| Field | Status |
|---|---|
| Honest current answer | **No** |
| Technical evidence | `docs/security/DATA_RETENTION_AND_DELETION_POLICY.md` (DRAFT): retention periods and procedures. `security_002_consent.sql`: `data_deletion_requests` table. `src/routes/plaid.ts`: `POST /plaid/deletion-request` stub route. |
| Operational evidence | ❌ Deletion route is a stub. ❌ No automated deletion job. ❌ Policy not yet approved. |
| Remaining action | Approve policy. Implement deletion route (remove Plaid item, clear consent records). Build deletion audit trail. |
| Safe to submit now | **No** — deletion not implemented. |

---

## Honest summary: answers to all 11 questions as of 2026-07-22

| Q | Question | Honest Answer | Safe to Submit |
|---|---|---|---|
| 1 | Security contact | Allison Fabbri, allison@cardealer.ai | ✅ Yes |
| 2 | Information security policy | 3 policies approved; 6 remaining in draft | ⚠️ Partial |
| 3 | Access controls | Yes — RBAC, MFA, bcrypt, DB separation all confirmed | ✅ Yes |
| 4 | Consumer-facing MFA | Yes — TOTP MFA merged, deployed, verified by Allison | ✅ Yes |
| 5 | Critical-system MFA | Yes — all platforms verified 2026-07-22 | ✅ Yes |
| 6 | TLS 1.2+ | Yes — platform-enforced; run verification before final submit | ⚠️ Conditional |
| 7 | Encryption at rest | Provider-managed yes; Plaid token encryption not yet implemented | ⚠️ Partial |
| 8 | Vulnerability management | Yes — Dependabot active, CI audit, manual check, approved policy | ✅ Yes |
| 9 | Privacy policy | Policy approved and route live; stable URL not yet established | ⚠️ Blocked on URL only |
| 10 | Consumer consent | No — Plaid not integrated | ❌ No |
| 11 | Data retention/deletion | No — deletion not implemented | ❌ No |

**Current safe-to-submit count: 5 confirmed Yes (Q1, Q3, Q4, Q5, Q8). Q2/Q6/Q7/Q9 conditionally ready with specific remaining actions. Q10/Q11 blocked on Plaid integration.**

---

## Remaining items before Plaid questionnaire submission

### Blockers (cannot submit without these)
1. **Q9 — Stable privacy policy URL:** Deploy FinanceOS to a stable Replit URL. Provide `https://<stable-url>/privacy` to Plaid.
2. **Q10/Q11 — Plaid not integrated:** Install Plaid SDK, implement Link flow, real consent, and deletion route. These are full feature blockers.

### Strongly recommended before submission
3. **Q2 — Approve remaining 6 policies:** Allison reviews and signs off on INFORMATION_SECURITY_POLICY, ACCESS_CONTROL_POLICY, DATA_RETENTION_AND_DELETION_POLICY, INCIDENT_RESPONSE_PLAN, THIRD_PARTY_AND_VENDOR_SECURITY_POLICY, SECURITY_ROLES_AND_RESPONSIBILITIES.
4. **Q6 — TLS verification:** Run `curl -sI https://<deployed-url> | grep -i "strict-transport\|server"` against stable deployed URL.
5. **Q7 — Plaid token encryption:** Implement when Plaid SDK is installed.
6. **Q8 — Fresh audit in Replit Shell:** Run `pnpm run security:vulnerability-check` in Replit to confirm 0 production runtime high/critical. Also verify GitHub secret scanning is enabled.

---

## Verified facts (source code, 2026-07-22)

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
| /privacy is a public route | `artifacts/financeos/src/App.tsx` — `/privacy` route NOT wrapped in `<ProtectedRoute>` |
| Dependabot active on main | `.github/dependabot.yml` — merged to main in squash commit 4289ebf (2026-07-22) |
| Vulnerability policy approved | `docs/security/VULNERABILITY_AND_PATCH_MANAGEMENT_POLICY.md` — approved 2026-07-22 by Allison Fabbri |
| 879+ unit tests pass | backend vitest (32 files, 879 tests) + frontend; 11 pre-existing failures in main's test files (getCtxBlocks/isPreviewMode not exported) |
