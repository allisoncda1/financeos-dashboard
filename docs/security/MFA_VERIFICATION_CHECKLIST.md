> **DRAFT — NOT YET APPROVED.** Effective date: [PENDING APPROVAL]

# MFA Verification Checklist — FinanceOS Critical Systems

**Operator:** Allison Fabbri (`allison@cardealer.ai`)  
**Date to complete:** [Fill in after manual verification]

Complete each section below. Mark ✅ when confirmed, ❌ if not yet enabled, ❓ if method unclear.

---

## MFA Method Classification

| Type | Examples | Phishing-resistant? |
|---|---|---|
| Hardware security key (FIDO2/WebAuthn) | YubiKey, Google Titan Key | ✅ Yes |
| Passkey (device-bound) | Face ID, Touch ID, Windows Hello | ✅ Yes |
| Authenticator app (TOTP) | Google Authenticator, Authy, 1Password | ⚠️ No (phishable) |
| SMS / phone call OTP | Carrier text message | ❌ No (SIM-swappable) |
| Email OTP | OTP sent to email inbox | ❌ No |

---

## 1. Google Account (`allison@cardealer.ai`)

**Why critical:** Controls Google Cloud Console access → GCP Secret Manager (QBO tokens) → entire pipeline.

**Steps:**
1. Go to: https://myaccount.google.com/security
2. Find section **"How you sign in to Google"**
3. Click **"2-Step Verification"**
4. Look for status: **"On"** (green) vs **"Off"**

**What to record:**
- [ ] 2-Step Verification: On / Off
- [ ] Method(s) in use: ______________________
- [ ] Passkeys enrolled: Yes / No
- [ ] Security keys enrolled: Yes / No
- [ ] Backup codes downloaded: Yes / No
- [ ] Recovery email/phone: ______________________

**How to enable if Off:**
1. Click **"2-Step Verification"** → **"Get Started"**
2. Recommended: Add a passkey (Face ID) or hardware key first
3. Add authenticator app (Google Authenticator or Authy) as backup
4. Download backup codes and store in password manager

---

## 2. Google Cloud Console

**Why critical:** Admin access to GCP project hosting Secret Manager.

**Steps:**
1. Go to: https://console.cloud.google.com/iam-admin/iam
2. Verify your account (`allison@cardealer.ai`) has the required role (likely `Owner` or `Editor`)
3. Go to: https://console.cloud.google.com/iam-admin/service-accounts — verify only the WIF service account exists (no extra service accounts with keys)

**Note:** GCP human MFA is inherited from Google Account (Step 1 above). If Google Account has MFA, GCP is protected.

**What to record:**
- [ ] GCP project name: ______________________
- [ ] Only WIF service account present (no stored JSON keys): Yes / No
- [ ] MFA inherited from Google Account: Yes (if Google MFA is enabled)

---

## 3. GitHub — Account `allisoncda1`

**Why critical:** Controls production code, GitHub Encrypted Secrets (QBO credentials, DB URLs), CI pipeline.

**Steps:**
1. Go to: https://github.com/settings/security
2. Under **"Two-factor authentication"**, verify status is **"Enabled"**
3. Check method: authenticator app, SMS, or security key

**Branch protection verification:**
1. Go to: https://github.com/allisoncda1/financeos-dashboard/settings/branches
2. Verify a rule exists for `main` with:
   - [ ] "Require a pull request before merging"
   - [ ] "Require status checks to pass"
   - [ ] "Require branches to be up to date"

**PAT audit:**
1. Go to: https://github.com/settings/tokens
2. Review all active PATs — confirm none are embedded in git remote URLs
3. Check locally: `git -C ~/Documents/qbo_extract remote -v` (do not paste output in chat)

**What to record:**
- [ ] 2FA: Enabled / Disabled
- [ ] 2FA method: ______________________
- [ ] Branch protection on `main`: Yes / No
- [ ] Active PATs reviewed: Yes / No
- [ ] Embedded PAT in qbo_extract remote: Yes (needs rotation) / No

---

## 4. Replit

**Why critical:** Hosts the production FinanceOS Dashboard; stores Replit Secrets (admin password, DB URLs, QBO tokens).

**Steps:**
1. Log in to: https://replit.com
2. Click your avatar → **Account Settings**
3. Find **"Two-factor authentication"** or **"Security"** section
4. Verify status

**Also verify:**
- [ ] FINANCEOS_ADMIN_PASSWORD in Replit Secrets starts with `$2b$` (bcrypt hash, not plaintext)
  - Go to your Repl → Secrets tab → FINANCEOS_ADMIN_PASSWORD → View (first characters only)

**What to record:**
- [ ] Replit 2FA: Enabled / Disabled
- [ ] 2FA method: ______________________
- [ ] Admin password is bcrypt hashed: Yes / No

---

## 5. Neon (PostgreSQL)

**Why critical:** Production database — financial data for all 4 entities.

**Steps:**
1. Go to: https://console.neon.tech
2. Click your avatar → **Profile** or **Account Settings**
3. Look for **"Security"** or **"Two-factor authentication"**

**Also verify database roles:**
- In Neon SQL Editor, run (safe, read-only):
  ```sql
  SELECT rolname, rolsuper, rolcreatedb, rolcreaterole 
  FROM pg_roles 
  WHERE rolname IN ('financeos_dashboard', 'postgres', 'neondb_owner');
  ```
- Confirm `financeos_dashboard` has no superuser/createdb privileges

**What to record:**
- [ ] Neon 2FA: Enabled / Disabled
- [ ] 2FA method: ______________________
- [ ] `financeos_dashboard` role is read-only: Yes / No

---

## 6. Intuit Developer Console

**Why critical:** Manages the QBO OAuth2 app credentials (client_id, client_secret) that grant access to all 4 company QBO accounts.

**Steps:**
1. Go to: https://developer.intuit.com
2. Click your account icon → **My Account** or **Profile**
3. Look for **"Security"** or **"Two-Step Verification"**

**What to record:**
- [ ] Intuit Developer 2FA: Enabled / Disabled
- [ ] 2FA method: ______________________

---

## 7. QuickBooks Online — Company Administrator Accounts

**Why critical:** Direct access to financial data for each of the 4 entities.

**Steps (repeat for each company):**
1. Log into QBO for each company
2. Click gear icon → **Account and Settings** → **User management**
3. Verify only authorized users have admin access
4. Go to: https://accounts.intuit.com → Security → Two-step verification

**Companies to verify:**
- [ ] T3 Marketing — admin account MFA: ______________________
- [ ] CarDealer.AI — admin account MFA: ______________________
- [ ] TopMrktr — admin account MFA: ______________________
- [ ] Smile More — admin account MFA: ______________________

---

## 8. Plaid (when integration is added)

**Steps (applicable when Plaid account is created):**
1. Go to: https://dashboard.plaid.com → Settings → Team
2. Verify all team members have 2FA enabled
3. Verify API keys are restricted to required environments (Sandbox/Production)

**What to record:**
- [ ] Plaid dashboard 2FA: Enabled / Disabled / Not yet applicable
- [ ] API key environments correctly scoped: Yes / No / Not yet applicable

---

## Summary Table (fill in after verification)

| System | MFA Status | MFA Method | Phishing-Resistant | Verified Date | Notes |
|---|---|---|---|---|---|
| Google Account | | | | | |
| Google Cloud | | (inherited) | | | |
| GitHub | | | | | |
| Replit | | | | | |
| Neon | | | | | |
| Intuit Developer | | | | | |
| QBO T3 Marketing | | | | | |
| QBO CarDealer.AI | | | | | |
| QBO TopMrktr | | | | | |
| QBO Smile More | | | | | |
| Plaid | N/A | N/A | N/A | | Not yet integrated |

---

## Recommended MFA Priority Order

1. **Google Account** — highest risk (controls GCP, Gmail, entire identity)
2. **GitHub** — controls code and secrets
3. **Replit** — controls production environment
4. **Intuit Developer** — controls QBO API access
5. **QBO company admins** — controls financial data directly
6. **Neon** — database access
