> **DRAFT — NOT YET APPROVED.** Effective date: [PENDING APPROVAL]

# Endpoint and Device Security Checklist
**Operator:** Allison Fabbri  
**Review frequency:** Quarterly

FinanceOS does not use an MDM (Mobile Device Management) system. This manual checklist serves as the compensating control for endpoint security.

---

## macOS Security Settings

### 1. Automatic Security Updates
**Where:** System Settings → General → Software Update → "Automatic Updates" (click ⓘ)  
**Verify:** "Install Security Responses and System Files" is **ON**  
**Why:** Patches kernel and system vulnerabilities without waiting for full macOS update  
- [ ] Enabled ✅

### 2. FileVault (Disk Encryption)
**Where:** System Settings → Privacy & Security → FileVault  
**Verify:** Status shows **"FileVault is turned on"**  
**Why:** Protects data at rest if device is lost or stolen. Required for any device storing financial credentials.  
- [ ] Enabled ✅
- [ ] Recovery key stored securely (not in plaintext on the same device): ✅

### 3. Screen Lock (Auto-lock)
**Where:** System Settings → Lock Screen  
**Verify:**  
- "Require password" is set to **"Immediately"** or **"After 1 minute"**  
- Screen saver timeout: 5 minutes or less  
**Why:** Prevents unauthorized access if device is left unattended  
- [ ] Screen lock: ≤ 1 minute ✅

### 4. Firewall
**Where:** System Settings → Network → Firewall  
**Verify:** Firewall is **"Active"**  
- [ ] Enabled ✅

---

## Browser Security

### 5. Browser Updates
**Google Chrome:**  
- Click ⋮ → Help → About Google Chrome  
- Status should show "Chrome is up to date"  
- [ ] Chrome up to date ✅

**Safari:**  
- Updates via macOS Software Update → Safari is bundled with macOS  
- [ ] Safari up to date (via macOS update) ✅

### 6. Browser Extensions Audit
- Review installed extensions for any unknown or suspicious entries
- Remove extensions with broad permissions that aren't actively used  
- [ ] Extensions reviewed ✅

---

## Local Secret Hygiene

### 7. No Plaintext Secrets in Local Files
Check for plaintext credentials in common locations:
```bash
# Run these locally — do NOT paste output in chat
# These commands list file NAMES only, not contents:
find ~ -name ".env" -not -path "*/node_modules/*" 2>/dev/null | head -20
find ~ -name "*.env" -not -path "*/node_modules/*" 2>/dev/null | head -20
find ~/Documents -name "companies.json" 2>/dev/null
```
- [ ] No `.env` files with real credentials outside gitignored locations ✅
- [ ] `companies.json` not committed to git (verify with `cat /tmp/financeos/.gitignore | grep companies`) ✅

### 8. Git Remote URL Audit
```bash
# Run locally — do NOT paste output in chat:
git -C ~/Documents/qbo_extract remote -v
# If URL contains https://[token]@github.com/ → PAT is embedded → rotate immediately
```
- [ ] No PAT embedded in git remote URLs ✅

### 9. Password Manager
Use a password manager (1Password, Bitwarden, etc.) for:
- All service passwords (GitHub, Google, Replit, Neon, Intuit)
- Recovery codes for MFA
- Do not save passwords in browser only  
- [ ] Password manager in use ✅

---

## Summary

| Check | Status | Date Verified |
|---|---|---|
| macOS auto-security-updates | | |
| FileVault enabled | | |
| Screen lock ≤ 1 minute | | |
| Firewall enabled | | |
| Browser up to date | | |
| No plaintext secrets in files | | |
| No PAT in git remote | | |
| Password manager in use | | |
