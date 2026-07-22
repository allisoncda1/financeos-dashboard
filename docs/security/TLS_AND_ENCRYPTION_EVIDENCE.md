# TLS and Encryption Evidence

**Document status:** Living reference — update when new controls are added.  
**Last updated:** 2026-07-21  
**Branch:** security/plaid-production-readiness

---

## Summary Table

| TLS / Encryption Control | Status | Evidence | Notes |
|---|---|---|---|
| Replit HTTPS / TLS termination | Active | `app.ts` line 73: `app.set("trust proxy", 1)` | Replit terminates TLS at its reverse proxy; Express trusts exactly one proxy hop |
| Session cookie `secure` flag | Active (production) | `app.ts` line 62: `secure: process.env["NODE_ENV"] === "production"` | Cookie only sent over HTTPS in production |
| Neon PostgreSQL TLS | Active (enforced) | Neon default: `sslmode=require`; see `.agents/memory/neon-restricted-dashboard-role.md` | Neon rejects plaintext connections by default; no opt-out needed |
| QBO API TLS | Active | `BASE=https://quickbooks.api.intuit.com` in `.env.example`; `connectors/quickbooks.py` uses `requests` (enforces HTTPS) | All Intuit API calls over TLS 1.2+ |
| Plaid API TLS (future) | Planned | Plaid documentation: TLS 1.2+ required; Plaid Link is browser-HTTPS-only | Will be enforced when `@plaid/plaid-node` is installed |
| Replit Secrets encryption at rest | Active | Replit Secrets documentation: secrets encrypted at rest | Covers `SESSION_SECRET`, `DATABASE_URL`, `CORE_DATABASE_URL`, future `PLAID_*` keys |
| Neon database encryption at rest | Active | Neon documentation: AES-256 encryption at rest | Covers all tables in both Dashboard and Core databases |
| GCP Secret Manager encryption at rest | Active | Google-managed keys (CMEK available on request) | Used by Python connector layer for OAuth tokens |
| GitHub Encrypted Secrets | Active | libsodium sealed-box encryption at rest | CI/CD secrets for GitHub Actions workflows |
| TOTP secrets (application-layer) | Planned | `security_001_mfa.sql` migration (pending): column `totp_secret_encrypted` | AES-256-GCM at application layer before DB storage |
| Plaid access tokens (application-layer) | Planned | `security_002_consent.sql` migration (pending): column `access_token_encrypted` | AES-256-GCM at application layer; plaintext access token never written to DB |
| Session data encryption at rest | Active (Neon AES-256) | `app.ts`: `connect-pg-simple` stores sessions in Neon `session` table | Session rows contain: `sid`, `sess` (JSON: email, role, name — no passwords), `expire` |

---

## Detail

### 1. Replit TLS (HTTPS termination)

Replit provides automatic HTTPS for all hosted Repls. The platform terminates TLS at its reverse proxy and forwards requests to the Express process over an internal channel.

**Configuration evidence** (`artifacts/api-server/src/app.ts`):
- Line 73: `app.set("trust proxy", 1)` — tells Express to trust exactly one proxy hop for `req.ip`, `req.protocol`, and secure-cookie detection.
- Line 62: `secure: process.env["NODE_ENV"] === "production"` — session cookie is only transmitted over HTTPS when running in production.

### 2. Neon PostgreSQL TLS

Neon enforces TLS on all client connections by default. The `sslmode=require` behavior is the Neon default; no additional connection-string parameter is needed. Plaintext connections are rejected.

**Evidence:**
- Neon documentation: "All connections to Neon require SSL/TLS."
- `.agents/memory/neon-restricted-dashboard-role.md`: documents the read-only `dashboard_ro` role configuration on Neon, which inherits the same TLS requirement.
- Two connection strings are in use: `DATABASE_URL` (Dashboard ops, writable) and `CORE_DATABASE_URL` (financial data, read-only). Both are Neon endpoints and both enforce TLS.

### 3. QuickBooks Online API TLS

All QBO API calls use HTTPS to `api.quickbooks.intuit.com`. The Python connector uses the `requests` library, which validates TLS certificates by default (does not pass `verify=False`).

**Evidence:**
- `.env.example`: `BASE=https://quickbooks.api.intuit.com`
- `/tmp/financeos/connectors/quickbooks.py`: uses `requests` library with standard HTTPS endpoints.
- Intuit requires TLS 1.2+ on all API connections per their developer documentation.

### 4. Future Plaid TLS

When Plaid integration is activated, all API calls will use Plaid's HTTPS endpoints. Plaid Link (the browser-side component) is loaded from Plaid's CDN over HTTPS.

**Requirements (from Plaid documentation):**
- Plaid API: TLS 1.2 minimum on all connections.
- Plaid Link: requires the host page to be served over HTTPS.
- Production Plaid credentials will be stored in Replit Secrets (encrypted at rest).

### 5. Encryption at Rest

| Layer | Provider | Method |
|---|---|---|
| Replit Secrets | Replit | Encrypted at rest (Replit Secrets documentation) |
| Neon database | Neon / AWS | AES-256 at rest (Neon documentation) |
| GCP Secret Manager | Google | Google-managed keys (AES-256) |
| GitHub Encrypted Secrets | GitHub | libsodium sealed boxes |

### 6. Application-Layer Encryption (Planned)

Two classes of sensitive values will be encrypted at the application layer (AES-256-GCM) before being written to Neon:

- **TOTP secrets**: stored in `user_mfa.totp_secret_encrypted` (migration `security_001_mfa.sql`, pending approval).
- **Plaid access tokens**: stored in `plaid_connections.access_token_encrypted` (migration `security_002_consent.sql`, pending approval).

This ensures that a read of the database row alone is insufficient to recover the plaintext secret — the application-layer encryption key (stored in Replit Secrets / GCP Secret Manager) is also required.

### 7. Session Data

Sessions are stored in Neon via `connect-pg-simple`. The `session` table contains:
- `sid`: session ID (opaque random string)
- `sess`: JSON object with `{ email, role, name }` — no passwords or financial data
- `expire`: TTL timestamp

Session data is protected at rest by Neon's AES-256 disk encryption and in transit by the Neon TLS requirement.

---

## Out of Scope (this document)

- Email/SMS transport encryption: no email or SMS infrastructure exists in FinanceOS at this time.
- End-to-end encryption of financial reports: reports are generated server-side and served over HTTPS; no additional E2E layer is currently implemented.
