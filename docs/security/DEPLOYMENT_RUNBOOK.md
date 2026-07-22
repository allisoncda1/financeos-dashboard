> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# FinanceOS Security Deployment Runbook

**Scope:** One-time operational steps to activate all security controls before Plaid submission.  
**Owner:** Allison Fabbri  
**Do not skip or reorder steps.** Each step depends on the previous.

---

## Safety rules

- **Do not paste passwords, encryption keys, or recovery codes into chat, email, screenshots, or notes.**
- **Do not run commands with secrets in the argument string** — this puts them in shell history and `ps aux`.
- **All commands below use shell variables or stdin** — the secret never appears in the command itself.
- If a step fails, stop and investigate before continuing. Do not move to step N+1 if step N failed.
- This runbook does not deploy to production. It prepares secrets and migrations for the development environment. A separate deployment step is required after verification.

---

## Step 1 — Generate the TOTP encryption key

**Do not run this command in the Replit Shell — Replit shells log all output to the server console.**

Run this on your local Mac terminal where output stays on your machine:

```bash
# On your local Mac terminal ONLY — pipes directly to clipboard, nothing displayed:
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | pbcopy
```

The 64-character hex key is now in your clipboard. It was never displayed in the terminal. Proceed immediately to Step 2 and paste it into Replit Secrets before copying anything else.

**If pbcopy is not available** (Linux): pipe to `xclip -selection clipboard` or `xsel --clipboard --input` instead. As a last resort, print it in a new private/incognito terminal window that you close immediately after copying — but this leaves the value in shell history.

**Do not:** save the key to a file, paste it into a chat, screenshot it, or share it.

---

## Step 2 — Store the encryption key in Replit Secrets

1. Open the Replit project for `financeos-dashboard`.
2. Open **Secrets** (left sidebar lock icon).
3. Create a new secret:
   - **Key:** `TOTP_ENCRYPTION_KEY`
   - **Value:** the 64-character hex string from Step 1
4. Save.

**Verify (without printing the value):**
```bash
# In Replit Shell — confirms key is present and correct length:
node -e '
const k = process.env["TOTP_ENCRYPTION_KEY"];
if (!k) { console.error("NOT SET"); process.exit(1); }
if (!/^[0-9a-fA-F]{64}$/.test(k)) { console.error("WRONG FORMAT — expected 64 hex chars, got", k.length); process.exit(1); }
console.log("OK — 64-char hex key present");
'
```

Expected output: `OK — 64-char hex key present`

> **Note on the regex:** `/^[0-9a-fA-F]{64}$/` — the trailing `$` is the JavaScript end-of-string anchor, not a literal dollar-sign character. The script is wrapped in single quotes so no shell variable expansion occurs, and the regex reaches Node exactly as written.

---

## Step 3 — Configure ALLOWED_ORIGINS

1. In Replit Secrets, create or update:
   - **Key:** `ALLOWED_ORIGINS`
   - **Value:** your Replit app's HTTPS hostname, e.g. `https://financeos-dashboard.your-username.repl.co`
   - If you have multiple hostnames (staging + prod), separate with commas: `https://a.repl.co,https://b.repl.co`

**Why:** Without this, the CORS allowlist is empty in production mode and all cross-origin requests are rejected.

---

## Step 4 — Generate the admin password hash

**Run this on your local Mac terminal only. Do not run it in Replit Shell.**

The committed script `scripts/gen-bcrypt-hash.sh` handles all of the following safely:

- Disables terminal echo using `read -s` (bash built-in) and `stty -echo` (belt-and-suspenders), so keystrokes are never visible.
- Requires you to type the password twice; exits without producing a hash if the two entries do not match.
- The plaintext password flows from your keyboard → bash variable → Node stdin pipe and is never placed in command arguments, environment variables, files, logs, clipboard, or shell history.
- Sends the bcrypt hash directly to your clipboard via `pbcopy`. The hash is never displayed.
- Restores terminal echo unconditionally via a cleanup trap, even on Ctrl-C or error.

```bash
# On your local Mac terminal — from the repo root:
bash scripts/gen-bcrypt-hash.sh
```

The script prompts for the password twice, confirms they match, then prints:

```
Done. Bcrypt hash copied to clipboard (starts with $2b$12$).

Next steps:
  1. Paste the hash into Replit Secrets as FINANCEOS_ADMIN_PASSWORD.
  2. Clear your clipboard immediately after: open any text editor,
     type or copy any character, then discard the document without saving.
  3. Verify the secret is set (see DEPLOYMENT_RUNBOOK.md Step 5).
```

> **Why not readline.createInterface?** Node's `readline.createInterface` with `output: process.stderr` only redirects the prompt string. It does NOT disable terminal echo — keystrokes remain visible. The committed script uses `read -s` which is the standard bash mechanism for genuinely hidden input.

---

## Step 5 — Store the bcrypt hash in Replit Secrets

1. In Replit Secrets, create or update:
   - **Key:** `FINANCEOS_ADMIN_PASSWORD`
   - **Value:** the `$2b$12$...` hash from Step 4
2. Save.

**Verify (without printing the value):**
```bash
node -e "
const pw = process.env['FINANCEOS_ADMIN_PASSWORD'];
if (!pw) { console.error('NOT SET'); process.exit(1); }
if (!pw.startsWith('\$2b\$') && !pw.startsWith('\$2a\$')) { console.error('NOT A BCRYPT HASH — prefix is', pw.slice(0,7)); process.exit(1); }
console.log('OK — bcrypt hash present, prefix:', pw.slice(0,7));
"
```

Expected output: `OK — bcrypt hash present, prefix: $2b$12$`

---

## Step 6 — Apply security_001_mfa.sql to the operational database

**Target:** `DATABASE_URL` — the Dashboard's writable Replit-provisioned PostgreSQL.  
**NOT:** `CORE_DATABASE_URL` (that is the read-only Core financial database).

Run preflight first to confirm the migration has not already been applied:

```bash
psql $DATABASE_URL -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_mfa', 'mfa_audit_log');
"
```

Expected: **0 rows**. If you see 2 rows, the migration is already applied — skip to Step 7.

Apply:
```bash
psql $DATABASE_URL \
  -f artifacts/api-server/src/db/migrations/security_001_mfa.sql
```

Verify:
```bash
psql $DATABASE_URL -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('user_mfa', 'mfa_audit_log');
"
# Expected: 2 rows

psql $DATABASE_URL -c "
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_mfa'
  AND column_name IN ('totp_secret_encrypted', 'last_totp_step', 'locked_until');
"
# Expected: 3 rows — totp_secret_encrypted (text), last_totp_step (bigint), locked_until (timestamp with time zone)
```

---

## Step 7 — Apply security_002_consent.sql

Same target as Step 6 (`DATABASE_URL`). Prerequisite: Step 6 complete.

Preflight:
```bash
psql $DATABASE_URL -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('plaid_consent_records','plaid_connections','data_deletion_requests');
"
```

Expected: **0 rows**. If 3 rows, already applied — skip.

Apply:
```bash
psql $DATABASE_URL \
  -f artifacts/api-server/src/db/migrations/security_002_consent.sql
```

Verify:
```bash
psql $DATABASE_URL -c "
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('plaid_consent_records','plaid_connections','data_deletion_requests');
"
# Expected: 3 rows
```

---

## Step 8 — Restart the application

In Replit, click **Stop** and then **Run** (or use the Workflows run button). The server reads Secrets at startup — secrets added after the last start are not live until restart.

**Verify startup in server logs:**
```
[mfa] TOTP_ENCRYPTION_KEY configured — AES-256-GCM key present (64-char hex OK)
[auth] Admin password: bcrypt hash configured (prefix: $2b$12$...)
```

If you see a warning instead of confirmation, recheck Steps 2 and 5.

---

## Step 9 — Enroll the administrator in TOTP MFA

1. Open the FinanceOS Dashboard in a browser.
2. Log in with the admin email and the password from Step 4.
3. Navigate to **Account → Security → Set up MFA** (or the equivalent admin settings page).
4. Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password).
5. Enter the 6-digit code to confirm enrollment.
6. **Save the recovery codes** that are displayed. Print or store them in a password manager. They are shown once and never stored in plaintext.

---

## Step 10 — Verify all MFA controls

Test each control manually:

### 10a. Replay protection
1. Log in. When prompted for MFA, enter the current 6-digit code → success.
2. Log out immediately. Log in again.
3. Enter the **same** 6-digit code before the 30-second window expires → must be rejected with "already been used".

### 10b. Lockout
1. Log in. At the MFA prompt, enter `000000` five times in a row.
2. On the 6th attempt (or after the 5th failure), confirm the account is locked.
3. Check the database: `psql $DATABASE_URL -c "SELECT locked_until FROM user_mfa WHERE user_email = 'your-email';"` — should show a timestamp ~15 minutes in the future.
4. Wait 15 minutes (or temporarily set `locked_until = now() - interval '1 minute'` to test recovery).

### 10c. Session regeneration
1. Before logging in, note the session cookie value (DevTools → Application → Cookies).
2. Submit credentials → after password success but before MFA, session cookie should change.
3. Submit MFA code → session cookie should change again.

### 10d. Protected route enforcement
1. In a browser with no session cookie, call `GET /api/auth/me` directly.
2. Expected: `401 Unauthorized` with `NOT_AUTHENTICATED`.
3. After password login but before MFA (mfaPending state), call any protected route.
4. Expected: `401 Unauthorized` with `MFA_REQUIRED`.

### 10e. Logout
1. Log in fully.
2. Call `POST /api/auth/logout`.
3. Session cookie should be cleared. Subsequent `GET /api/auth/me` must return 401.

### 10f. Recovery code
1. Log in. At the MFA prompt, choose "Use recovery code".
2. Enter one of the 10 recovery codes → success.
3. Log out and log in again. Try the same recovery code → must be rejected (single-use).

---

## Step 11 — Rollback procedure

If any step fails and you need to roll back:

**Remove MFA tables (only if no enrollment has occurred):**
```sql
-- Run via psql $DATABASE_URL
BEGIN;
DROP TABLE IF EXISTS mfa_audit_log;
DROP TABLE IF EXISTS user_mfa;
COMMIT;
```

**Remove consent tables:**
```sql
BEGIN;
DROP TABLE IF EXISTS data_deletion_requests;
DROP TABLE IF EXISTS plaid_connections;
DROP TABLE IF EXISTS plaid_consent_records;
COMMIT;
```

**Emergency access if admin is locked out of MFA:**
```bash
# Clear MFA for the admin account — run in Replit Shell:
psql $DATABASE_URL -c "
UPDATE user_mfa
SET totp_enabled = false,
    totp_secret_encrypted = null,
    recovery_codes_hashed = null,
    recovery_codes_used = '{}',
    last_totp_step = null,
    failed_challenge_count = 0,
    locked_until = null,
    updated_at = now()
WHERE user_email = 'your-admin-email@domain.com';
"
```

After the emergency reset, re-enroll via Step 9.

**Remove encryption key (disables TOTP enrollment — existing enrollments also break):**
Delete `TOTP_ENCRYPTION_KEY` from Replit Secrets. Any enrolled user will be unable to challenge until re-provisioned.

---

## Step 12 — Prerequisites before Plaid submission

Do not submit the Plaid questionnaire until all of the following are confirmed:

- [ ] Steps 1–11 complete
- [ ] MFA verification checklist (`MFA_VERIFICATION_CHECKLIST.md`) completed for all platforms
- [ ] All 9 security policy documents reviewed and approved by Allison
- [ ] Privacy Policy published at a public URL
- [ ] Plaid SDK installed (currently not installed — routes are stubs)
- [ ] Plaid Link flow implemented
- [ ] Plaid access token encryption implemented
- [ ] `pnpm audit` run with 0 high/critical findings
- [ ] This runbook reviewed and approved
