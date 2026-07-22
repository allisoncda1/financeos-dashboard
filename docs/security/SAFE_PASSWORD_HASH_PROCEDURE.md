> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# Safe Admin Password Hash Procedure

**Purpose:** Generate a bcrypt hash of the FinanceOS admin password to store in Replit Secrets as `FINANCEOS_ADMIN_PASSWORD`. This procedure is designed so the plaintext password is never written to disk, never appears in shell history, and never appears in log output.

---

## Why this matters

Shell command history (`.bash_history`, `.zsh_history`) and process listings (`ps aux`) are readable by anyone with filesystem access. Running a command like:

```bash
# UNSAFE — do not use:
node -e "require('bcryptjs').hash('mypassword', 12).then(console.log)"
```

…embeds `mypassword` in your shell history file permanently. On a multi-user system or if history is synced (e.g., via dotfiles), this exposes the credential.

---

## Safe procedure (interactive — no plaintext in shell args)

**Step 1.** Open a terminal (local Mac terminal, NOT a Replit shell).

**Step 2.** Run Node in interactive mode — this reads input from stdin and does not log it:

```bash
node -e "
const bcrypt = require('bcryptjs');
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
rl.question('Enter admin password: ', async (pw) => {
  rl.close();
  const hash = await bcrypt.hash(pw, 12);
  process.stdout.write(hash + '\n');
});
"
```

**Step 3.** Type the password when prompted. The typed characters are not echoed to the terminal (stderr-only prompt).

**Step 4.** The hash is printed to stdout only. Copy it immediately.

**Step 5.** In Replit Secrets, set `FINANCEOS_ADMIN_PASSWORD` to the hash (begins with `$2b$12$`).

**Step 6.** Verify the secret was saved. Do not paste the hash anywhere else.

---

## Verification (confirm the hash works before relying on it)

Run the following to verify the hash without printing the password:

```bash
node -e "
const bcrypt = require('bcryptjs');
const hash = process.env.HASH;
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
rl.question('Enter password to verify: ', async (pw) => {
  rl.close();
  const ok = await bcrypt.compare(pw, hash);
  console.log(ok ? 'MATCH: hash is correct' : 'MISMATCH: hash does not match');
});
" 
```

Set `HASH` inline as an environment variable (not saved to history if prefixed with a space on bash/zsh):

```bash
 HASH='$2b$12$<your-hash-here>' node -e "..."
```

Note: leading space before the command suppresses it from bash/zsh history (only if `HISTCONTROL=ignorespace` is set, which is the default on most systems).

---

## bcrypt package availability

The procedure above uses `bcryptjs` (pure JavaScript). If it is not installed globally:

```bash
# In the financeos-dashboard repo:
pnpm --filter api-server exec node -e "..."
```

---

## Rotation

When rotating the admin password:

1. Generate the new hash using the safe procedure above.
2. Update `FINANCEOS_ADMIN_PASSWORD` in Replit Secrets.
3. Verify the new hash works.
4. Confirm the old hash is no longer accepted.
5. Document the rotation date in the Security Roles document.

Do NOT store the old password or hash anywhere.
