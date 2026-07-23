> **APPROVED.** Approved by Allison Fabbri on 2026-07-22. Effective immediately.

# Security Control Evidence Register

**Version:** 1.0  
**Owner:** Allison Fabbri (allison@cardealer.ai)  
**Last Updated:** 2026-07-22  
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
| Bcrypt password hashing (cost 12) | Auth | **Operational** | `artifacts/api-server/src/auth/service.ts:79` | 2026-07-22 | Plain-text fallback removed in PR #29 |
| Rate limiting on login | Auth | **Operational** | `artifacts/api-server/src/routes/auth.ts:8` | 2026-07-22 | 10 req / 15 min |
| TOTP MFA (application) | Auth | **Operational** | `artifacts/api-server/src/auth/mfaRoutes.ts` | 2026-07-22 | Merged in squash commit 4289ebf; AES-256-GCM encrypted secrets, lockout (5 fails / 15 min), replay protection, session regeneration |
| MFA enrollment UI | Auth | **Operational** | `artifacts/financeos/src/pages/mfa-setup.tsx` | 2026-07-22 | Merged PR #29; QR code + manual entry |
| MFA challenge UI | Auth | **Operational** | `artifacts/financeos/src/pages/mfa-challenge.tsx` | 2026-07-22 | Merged PR #29 |
| Session httpOnly cookie | Session | **Operational** | `artifacts/api-server/src/app.ts:59` | 2026-07-22 | |
| Session secure in production | Session | **Operational** | `artifacts/api-server/src/app.ts:61` | 2026-07-22 | sameSite: lax |
| Session 8-hour timeout | Session | **Operational** | `artifacts/api-server/src/app.ts:63` | 2026-07-22 | |
| Session fixation protection | Session | **Operational** | `artifacts/api-server/src/auth/mfaRoutes.ts` | 2026-07-22 | `session.regenerate()` called after password auth and after MFA success |
| Neon read-only DB role | DB | **Operational** | `.agents/memory/neon-restricted-dashboard-role.md` | 2026-07-22 | `financeos_dashboard` role; SELECT only on Core DB |
| GCP Workload Identity Federation | CI/CD | **Operational** | `.github/workflows/` (Core repo) | 2026-07-22 | No stored service account key |
| GitHub Encrypted Secrets | Secret Mgmt | **Operational** | `.github/workflows/` (Core repo) | 2026-07-22 | QBO credentials, DB URLs |
| Replit Secrets | Secret Mgmt | **Operational** | Replit console | 2026-07-22 | Admin password, DB URLs, TOTP encryption key |
| GCP Secret Manager | Secret Mgmt | **Operational** | `automation/secret_manager.py` (Core) | 2026-07-22 | QBO refresh tokens |
| Google Account MFA | Platform | **Operational** | myaccount.google.com/security | 2026-07-22 | Verified by Allison Fabbri |
| GitHub Account MFA | Platform | **Operational** | github.com/settings/security | 2026-07-22 | Verified by Allison Fabbri |
| Replit Account MFA | Platform | **Operational** | replit.com/account | 2026-07-22 | Verified by Allison Fabbri |
| Neon Console MFA | Platform | **Operational** | console.neon.tech | 2026-07-22 | Verified by Allison Fabbri |
| Intuit Developer MFA | Platform | **Operational** | developer.intuit.com | 2026-07-22 | Verified by Allison Fabbri |
| TLS (Replit) | Transport | **Operational** | Replit platform — auto TLS | 2026-07-22 | Provider-managed; HTTPS enforced |
| TLS (Neon) | Transport | **Operational** | Neon — TLS required on connections | 2026-07-22 | SSL enforced on database connections |
| Dependabot alerts (npm + GH Actions) | Vuln Mgmt | **Operational** | `.github/dependabot.yml` | 2026-07-22 | Active on main branch since squash commit 4289ebf (2026-07-22); weekly Monday scans; security group labels |
| Scheduled dependency audit | Vuln Mgmt | **Operational** | `.github/workflows/security-audit.yml` | 2026-07-22 | Weekly Monday 9am UTC; `pnpm audit --audit-level=high`; 90-day artifact retention |
| Manual vulnerability check command | Vuln Mgmt | **Operational** | `package.json` → `security:vulnerability-check` | 2026-07-22 | `pnpm run security:vulnerability-check`; runs prod + full audit with severity separation |
| Latest production audit result | Vuln Mgmt | **Known findings — tracked** | `pnpm audit --prod` run 2026-07-22 | 2026-07-22 | 3 findings: 2 high (brace-expansion DoS via exceljs/archiver, GHSA-3jxr-9vmj-r5cp), 1 moderate (uuid <11.1.1 via @google-cloud/storage, GHSA-w5hq-g745-h8pq). All transitive. Remediating within SLA: high → by 2026-08-21; moderate → by 2026-10-21. Compensating control: internal-only platform, no external user input reaches these paths. |
| Secret scanning (GitHub) | Vuln Mgmt | **Unverified** | GitHub repo settings → Security | — | Verify at github.com/allisoncda1/financeos-dashboard/settings/security |
| Privacy policy public route | Privacy | **Operational** | `artifacts/financeos/src/pages/privacy.tsx`; route `/privacy` in `App.tsx` | 2026-07-22 | Public route (no ProtectedRoute wrapper); accessible at dev URL; stable URL pending deployment |
| Plaid consent records | Consent | **Operational** | `artifacts/api-server/src/db/migrations/security_002_consent.sql` | 2026-07-22 | Schema implemented; Plaid SDK not yet integrated |
| Endpoint: FileVault | Endpoint | **Unverified** | macOS System Preferences → Privacy & Security → FileVault | — | Manual verification — see Endpoint checklist |
| Endpoint: Screen lock | Endpoint | **Unverified** | macOS System Preferences → Lock Screen | — | Manual verification — see Endpoint checklist |
| Endpoint: macOS security updates | Endpoint | **Unverified** | macOS System Preferences → General → Software Update | — | Manual verification — see Endpoint checklist |

---

## Note on Known Audit Findings (as of 2026-07-22)

### Production dependency findings (require SLA tracking)

`pnpm audit --prod` found **3 findings** (2 high, 1 moderate) — all transitive:

| Severity | Package | Advisory | SLA deadline |
|---|---|---|---|
| High | brace-expansion ≥2.0.0 <2.1.2 | GHSA-3jxr-9vmj-r5cp (DoS via exceljs→archiver) | 2026-08-21 |
| High | brace-expansion <1.1.16 | GHSA-3jxr-9vmj-r5cp (DoS via archiver-zip-encrypted) | 2026-08-21 |
| Moderate | uuid <11.1.1 | GHSA-w5hq-g745-h8pq (bounds check via @google-cloud/storage) | 2026-10-21 |

Compensating control for all three: FinanceOS is an internal-only platform. No external user-supplied input reaches any of these code paths (`exceljs` Excel generation is internal, `@google-cloud/storage` uses hardcoded bucket names). Exploitability is significantly reduced relative to externally facing applications.

Remediation path: Dependabot will open PRs to update `exceljs` (which transitively pulls brace-expansion) and `@google-cloud/storage` (which updates uuid). These will be reviewed and merged within the High SLA window (2026-08-21).

### Development-tooling advisories (not SLA-tracked)

Additional advisories appear in the full `pnpm audit` (without `--prod`), affecting packages in `devDependencies` or build/test-only tooling (esbuild, and similar). These are not bundled into the production runtime and are not subject to emergency SLA remediation.

---

## Verification Log

| Date | Control | Verified By | Method | Result |
|---|---|---|---|---|
| 2026-07-21 | Bcrypt password hashing | Allison Fabbri | Code review | Confirmed at `auth/service.ts:79` |
| 2026-07-21 | Rate limiting on login | Allison Fabbri | Code review | Confirmed at `routes/auth.ts:8` |
| 2026-07-21 | Session configuration | Allison Fabbri | Code review | httpOnly, secure, sameSite:lax, 8h TTL confirmed at `app.ts:59-63` |
| 2026-07-21 | Neon read-only role | Allison Fabbri | Memory/config review | `financeos_dashboard` role documented |
| 2026-07-21 | GCP WIF | Allison Fabbri | Workflow review | No stored service account key confirmed |
| 2026-07-22 | MFA across all critical platforms | Allison Fabbri | Manual verification | Google, GitHub, Replit, Neon, Intuit — all confirmed per MFA checklist |
| 2026-07-22 | Session fixation protection | Allison Fabbri | Code review | `session.regenerate()` present in `mfaRoutes.ts` — merged 4289ebf |
| 2026-07-22 | TOTP MFA (application) | Allison Fabbri | Code review + merge | mfaRoutes.ts, mfaCrypto.ts merged in 4289ebf |
| 2026-07-22 | Dependabot active on main | Allison Fabbri | GitHub merge | `.github/dependabot.yml` merged to main in 4289ebf |
| 2026-07-22 | Privacy policy public route | Allison Fabbri | Code review | `/privacy` route confirmed public (no ProtectedRoute) in App.tsx |

---

**Approved by:** Allison Fabbri, Controller & FinanceOS Project Lead  
**Approval date:** 2026-07-22  
**Document version:** 1.0
