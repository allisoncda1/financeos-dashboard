#!/usr/bin/env bash
# gen-bcrypt-hash.sh
#
# Generates a bcrypt hash of the FinanceOS admin password and copies it to the
# Mac clipboard (pbcopy). The plaintext password:
#   - never appears in command arguments, environment variables, or shell history
#   - never appears in log output, files, or clipboard
#   - is read with terminal echo disabled for the full input block
#   - is cleared from memory after the hash is produced
#
# Run this script on your LOCAL Mac terminal only.
# Do NOT run it in Replit Shell (server-side console logging).
#
# Usage:
#   bash scripts/gen-bcrypt-hash.sh
#
# Prerequisites: node (>=18), bcryptjs in node_modules, pbcopy (macOS)

set -euo pipefail

# ── Cleanup: restore terminal echo on any exit path ───────────────────────────
_cleanup() {
  # Restore echo unconditionally — no-op if already restored or never changed.
  stty echo 2>/dev/null || true
}
trap _cleanup EXIT INT TERM HUP

# ── Verify required tools ─────────────────────────────────────────────────────
command -v node >/dev/null 2>&1   || { printf 'ERROR: node not found\n' >&2; exit 1; }
command -v pbcopy >/dev/null 2>&1 || { printf 'ERROR: pbcopy not found — run this on a Mac\n' >&2; exit 1; }

# ── Resolve bcryptjs from the workspace ──────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Try workspace root first, then api-server package (pnpm may hoist either way)
BCRYPT_PATH=""
for candidate in \
  "$REPO_ROOT/node_modules/bcryptjs" \
  "$REPO_ROOT/artifacts/api-server/node_modules/bcryptjs"; do
  if [ -d "$candidate" ]; then
    BCRYPT_PATH="$candidate"
    break
  fi
done

if [ -z "$BCRYPT_PATH" ]; then
  printf 'ERROR: bcryptjs not found under %s\n' "$REPO_ROOT" >&2
  printf 'Run: pnpm install\n' >&2
  exit 1
fi

# ── Read password with echo disabled ─────────────────────────────────────────
# read -s: bash built-in that disables terminal echo for this read only.
# stty -echo: belt-and-suspenders; silently skipped if stdin is not a TTY
#             (e.g., during automated tests that pipe stdin).
printf 'Enter admin password: ' >&2
stty -echo 2>/dev/null || true
IFS= read -rs PASSWORD
stty echo 2>/dev/null || true
printf '\n' >&2

printf 'Confirm password: ' >&2
stty -echo 2>/dev/null || true
IFS= read -rs CONFIRM
stty echo 2>/dev/null || true
printf '\n' >&2

# ── Verify passwords match before producing any output ───────────────────────
if [ "$PASSWORD" != "$CONFIRM" ]; then
  printf 'ERROR: passwords do not match — no hash produced\n' >&2
  PASSWORD=""
  CONFIRM=""
  exit 1
fi
CONFIRM=""

# ── Generate bcrypt hash; pipe directly to clipboard — never displayed ────────
# The password reaches node via stdin (a pipe), never via a process argument.
# The hash goes to pbcopy only and is never stored in a shell variable.
export BCRYPT_PATH
printf '%s' "$PASSWORD" \
  | node -e "
      const bcrypt = require(process.env.BCRYPT_PATH);
      let buf = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function(d) { buf += d; });
      process.stdin.on('end', async function() {
        const hash = await bcrypt.hash(buf, 12);
        process.stdout.write(hash);
      });
    " \
  | pbcopy

PASSWORD=""

printf 'Done. Bcrypt hash copied to clipboard (starts with $2b$12$).\n' >&2
printf '\n' >&2
printf 'Next steps:\n' >&2
printf '  1. Paste the hash into Replit Secrets as FINANCEOS_ADMIN_PASSWORD.\n' >&2
printf '  2. Clear your clipboard immediately after: open any text editor,\n' >&2
printf '     type or copy any character, then discard the document without saving.\n' >&2
printf '  3. Verify the secret is set (see DEPLOYMENT_RUNBOOK.md Step 5).\n' >&2
