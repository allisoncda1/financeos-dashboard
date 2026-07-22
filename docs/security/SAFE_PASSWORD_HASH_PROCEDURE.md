> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# Safe Admin Password Hash Procedure

**Purpose:** Generate a bcrypt hash of the FinanceOS admin password to store in Replit Secrets as `FINANCEOS_ADMIN_PASSWORD`. This procedure ensures the plaintext password is never written to disk, never appears in shell history, and is never visible in the terminal.

---

## Why this matters

Shell command history (`.bash_history`, `.zsh_history`) and process listings (`ps aux`) are readable by anyone with filesystem access. Running a command like:

```bash
# UNSAFE — do not use:
node -e "require('bcryptjs').hash('mypassword', 12).then(console.log)"
```

…embeds `mypassword` in your shell history file permanently.

Similarly, Node's `readline.createInterface({ input: process.stdin, output: process.stderr })` does **not** disable terminal echo. Despite routing the prompt to stderr, the terminal remains in its default echo mode and every keystroke is visible on screen. **Do not use readline for password input.**

---

## Safe procedure — use the committed script

The repository includes a reviewed bash script that handles all security requirements:

```
scripts/gen-bcrypt-hash.sh
```

**Run this on your LOCAL Mac terminal only. Do not run it in Replit Shell** (Replit logs all console output server-side).

```bash
# From the repo root on your local Mac:
bash scripts/gen-bcrypt-hash.sh
```

### What the script does

| Property | How it is achieved |
|---|---|
| Terminal echo disabled | `read -s` (bash built-in) + `stty -echo` (belt-and-suspenders) |
| Echo restored on any exit | `trap _cleanup EXIT INT TERM HUP` calls `stty echo` |
| Password not in shell history | Never passed as a command argument; read via `read -rs` |
| Password not in process args | Flows to Node via stdin pipe (`printf '%s' "$PASSWORD" \| node -e ...`) |
| Password not in env vars | Only `BCRYPT_PATH` (the bcryptjs module path) is exported, not the password |
| Confirmation required | Exits with code 1 and produces no hash if entries do not match |
| Hash not displayed | Piped directly to `pbcopy` (clipboard); never written to stdout or a variable |
| Plaintext cleared | Shell variable set to `""` after the hash is produced |

### Step-by-step

**Step 1.** Open a local Mac terminal (Terminal.app or iTerm2). Close any screen-sharing or recording sessions.

**Step 2.** Navigate to the repo root:
```bash
cd ~/path/to/financeos-dashboard
```

**Step 3.** Run the script:
```bash
bash scripts/gen-bcrypt-hash.sh
```

**Step 4.** Type the password when prompted. No characters are displayed. Press Enter.

**Step 5.** Type the password again to confirm. Press Enter.

**Step 6.** On success, the script prints:
```
Done. Bcrypt hash copied to clipboard (starts with $2b$12$).
```
The hash is now in your clipboard.

**Step 7.** Immediately open Replit Secrets for the `financeos-dashboard` project and paste into `FINANCEOS_ADMIN_PASSWORD`.

**Step 8.** Clear your clipboard: open any text editor, type or copy any character, then close the document without saving.

---

## Verify the hash was saved correctly (in Replit Shell)

After restarting the application (DEPLOYMENT_RUNBOOK.md Step 8), verify the secret is a bcrypt hash without revealing its value:

```bash
node -e '
const pw = process.env["FINANCEOS_ADMIN_PASSWORD"];
if (!pw) { console.error("NOT SET"); process.exit(1); }
if (!pw.startsWith("$2b$") && !pw.startsWith("$2a$")) {
  console.error("NOT A BCRYPT HASH — prefix is", pw.slice(0, 7));
  process.exit(1);
}
console.log("OK — bcrypt hash present, prefix:", pw.slice(0, 7));
'
```

Expected output: `OK — bcrypt hash present, prefix: $2b$12$`

> **Note on the regex:** The `$` characters inside the single-quoted Node script are literal dollar signs in the JavaScript string, not shell variable expansions. Single quotes prevent shell interpretation.

---

## Password rotation

When rotating the admin password:

1. Run `bash scripts/gen-bcrypt-hash.sh` again on your local Mac.
2. Update `FINANCEOS_ADMIN_PASSWORD` in Replit Secrets with the new hash.
3. Restart the application.
4. Verify the new hash is accepted and the old password is rejected.
5. Document the rotation date in the Security Roles document.

Do NOT store the old password or hash anywhere.
