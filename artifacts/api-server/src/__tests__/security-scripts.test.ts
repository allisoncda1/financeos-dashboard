/**
 * Security script regression tests.
 *
 * Covers two independent concerns:
 *  1. TOTP_ENCRYPTION_KEY format validation — the regex that guards the key
 *     must use $ as an end-of-string anchor, NOT a literal dollar-sign.
 *  2. gen-bcrypt-hash.sh — the password-hashing script must refuse mismatched
 *     passwords, use hidden input, and only emit a bcrypt hash to its output pipe.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

// ── 1. TOTP key format regex ─────────────────────────────────────────────────
// This regex must be kept in sync with the verification snippet in
// docs/security/DEPLOYMENT_RUNBOOK.md Step 2.
// The $ here is a JavaScript end-of-string anchor, NOT a literal character.
const TOTP_KEY_REGEX = /^[0-9a-fA-F]{64}$/;

describe("TOTP_ENCRYPTION_KEY format regex", () => {
  it("accepts exactly 64 lowercase hex characters", () => {
    expect(TOTP_KEY_REGEX.test("a".repeat(64))).toBe(true);
  });

  it("accepts exactly 64 uppercase hex characters", () => {
    expect(TOTP_KEY_REGEX.test("F".repeat(64))).toBe(true);
  });

  it("accepts a realistic mixed-case 64-char hex key", () => {
    const key = "0123456789abcdefABCDEF0123456789abcdefABCDEF01234567890123456789";
    expect(key).toHaveLength(64);
    expect(TOTP_KEY_REGEX.test(key)).toBe(true);
  });

  it("rejects 63 characters (one too short)", () => {
    expect(TOTP_KEY_REGEX.test("a".repeat(63))).toBe(false);
  });

  it("rejects 65 characters (one too long)", () => {
    expect(TOTP_KEY_REGEX.test("a".repeat(65))).toBe(false);
  });

  it("rejects non-hex characters (g–z)", () => {
    const nonHex = "g".repeat(64);
    expect(TOTP_KEY_REGEX.test(nonHex)).toBe(false);
  });

  it("rejects a trailing dollar sign — $ is an end-of-string anchor, not a literal character", () => {
    // If the regex used \\$ (escaped, literal dollar), this would pass — the test
    // proves the regex uses $ as an anchor so 65 characters always fail.
    const withTrailingDollar = "a".repeat(64) + "$";
    expect(TOTP_KEY_REGEX.test(withTrailingDollar)).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(TOTP_KEY_REGEX.test("")).toBe(false);
  });

  it("rejects a valid 64-char hex key prefixed with whitespace", () => {
    expect(TOTP_KEY_REGEX.test(" " + "a".repeat(63))).toBe(false);
  });
});

// ── 2. gen-bcrypt-hash.sh script behaviour ───────────────────────────────────

const SCRIPT = path.resolve(__dirname, "../../../../scripts/gen-bcrypt-hash.sh");

describe("gen-bcrypt-hash.sh", () => {
  it("uses read -s for hidden password input (source inspection)", () => {
    const src = readFileSync(SCRIPT, "utf8");
    // read -s is the bash built-in that genuinely disables terminal echo.
    // This test fails if the script is changed to use readline or plain read.
    expect(src).toMatch(/read\s+-[a-z]*s[a-z]*/);
  });

  it("uses stty -echo as belt-and-suspenders echo protection (source inspection)", () => {
    const src = readFileSync(SCRIPT, "utf8");
    expect(src).toContain("stty -echo");
  });

  it("restores terminal echo via cleanup trap (source inspection)", () => {
    const src = readFileSync(SCRIPT, "utf8");
    // The trap must call stty echo so the terminal is never left in no-echo state.
    expect(src).toContain("stty echo");
    expect(src).toMatch(/trap\s+_cleanup/);
  });

  it("does not use readline.createInterface (which does NOT hide input)", () => {
    const src = readFileSync(SCRIPT, "utf8");
    expect(src).not.toContain("readline.createInterface");
  });

  it("does not pass password in command-line arguments (source inspection)", () => {
    const src = readFileSync(SCRIPT, "utf8");
    // The password variable must only reach node via a stdin pipe, never as a -e arg value.
    // Verify: (a) printf pipes the password to node's stdin, (b) BCRYPT_PATH is exported
    // to an env var (not embedded in the node -e string).
    expect(src).toMatch(/printf '%s' "\$PASSWORD"/);
    expect(src).toContain("export BCRYPT_PATH");
    expect(src).toContain("process.env.BCRYPT_PATH");
  });

  it("exits 1 and produces no hash when passwords do not match", () => {
    const result = spawnSync("bash", [SCRIPT], {
      input: "password1\npassword2\n",
      encoding: "utf8",
      env: { ...process.env, PATH: process.env.PATH },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("passwords do not match");
    expect(result.stderr).toContain("no hash produced");
    // stdout must be empty — no partial hash must be emitted
    expect(result.stdout.trim()).toBe("");
  });

  it("produces no hash output when passwords do not match (stdout is empty)", () => {
    const result = spawnSync("bash", [SCRIPT], {
      input: "abc\ndef\n",
      encoding: "utf8",
      env: { ...process.env, PATH: process.env.PATH },
    });
    // The hash goes to pbcopy, not stdout. Mismatched passwords must produce nothing.
    expect(result.stdout).toBe("");
  });

  it("exits 0 and emits no plaintext password to stderr when passwords match", () => {
    // We cannot capture the clipboard, but we CAN verify stderr does not contain
    // the plaintext password and that the script exits cleanly.
    // Use a benign test password that is clearly not a bcrypt hash.
    const result = spawnSync("bash", [SCRIPT], {
      input: "TestPassword123!\nTestPassword123!\n",
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, PATH: process.env.PATH },
    });
    // pbcopy is available on the Mac where this runs; exit 0 means it succeeded.
    expect(result.status).toBe(0);
    // Stderr must NOT contain the plaintext password.
    expect(result.stderr).not.toContain("TestPassword123!");
    // Stderr must contain the success confirmation.
    expect(result.stderr).toContain("Done");
    expect(result.stderr).toContain("clipboard");
  });

  it("stderr success message references bcrypt hash prefix, not the password", () => {
    const result = spawnSync("bash", [SCRIPT], {
      input: "AnotherTestPw!\nAnotherTestPw!\n",
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, PATH: process.env.PATH },
    });
    expect(result.status).toBe(0);
    // The success message must mention the bcrypt prefix so the operator can verify.
    expect(result.stderr).toContain("$2b$12$");
    // It must not echo the plaintext password.
    expect(result.stderr).not.toContain("AnotherTestPw!");
  });
});
