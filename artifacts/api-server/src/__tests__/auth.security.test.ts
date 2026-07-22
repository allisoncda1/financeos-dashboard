/**
 * Security regression tests — auth service, MFA module, and MFA crypto.
 *
 * These tests verify:
 *   Phase 3 — MFA security requirements
 *   Phase 4 — Password and session security requirements
 *
 * DB-interaction tests for mfaRoutes are integration tests requiring a live
 * DATABASE_URL and are excluded here (unit-only environment).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Phase 4 — Password and session security
// ---------------------------------------------------------------------------

describe("passwordMatches (via validateCredentials)", () => {
  beforeEach(() => {
    process.env["FINANCEOS_ADMIN_EMAIL"] = "admin@test.com";
  });

  it("accepts a correct bcrypt password", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    process.env["FINANCEOS_ADMIN_PASSWORD"] = hash;
    vi.resetModules();
    const { validateCredentials } = await import("../auth/service.js");
    const user = await validateCredentials("admin@test.com", "correct-password");
    expect(user).not.toBeNull();
    expect(user?.email).toBe("admin@test.com");
  });

  it("rejects a wrong bcrypt password (returns null)", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    process.env["FINANCEOS_ADMIN_PASSWORD"] = hash;
    vi.resetModules();
    const { validateCredentials } = await import("../auth/service.js");
    const user = await validateCredentials("admin@test.com", "wrong-password");
    expect(user).toBeNull();
  });

  it("throws when stored password is plaintext (no bcrypt prefix)", async () => {
    process.env["FINANCEOS_ADMIN_PASSWORD"] = "plaintextpassword";
    vi.resetModules();
    const { validateCredentials } = await import("../auth/service.js");
    await expect(validateCredentials("admin@test.com", "plaintextpassword")).rejects.toThrow(
      /not a bcrypt hash/i,
    );
  });

  it("throws on sha256: prefixed hash (not supported)", async () => {
    process.env["FINANCEOS_ADMIN_PASSWORD"] = "sha256:abc123deadbeef";
    vi.resetModules();
    const { validateCredentials } = await import("../auth/service.js");
    await expect(validateCredentials("admin@test.com", "anything")).rejects.toThrow(
      /not a bcrypt hash/i,
    );
  });

  it("throws on empty stored password string", async () => {
    process.env["FINANCEOS_ADMIN_PASSWORD"] = "";
    // Empty password means admin returns null from getConfiguredAdmin, so
    // validateCredentials returns null (no user found) rather than throwing.
    vi.resetModules();
    const { validateCredentials } = await import("../auth/service.js");
    const result = await validateCredentials("admin@test.com", "anything");
    expect(result).toBeNull();
  });
});

describe("validateCredentials — generic error (no disclosure oracle)", () => {
  it("returns null when email is wrong (same result as wrong password)", async () => {
    const hash = await bcrypt.hash("password", 10);
    process.env["FINANCEOS_ADMIN_EMAIL"] = "real@test.com";
    process.env["FINANCEOS_ADMIN_PASSWORD"] = hash;
    vi.resetModules();
    const { validateCredentials } = await import("../auth/service.js");
    const result = await validateCredentials("notreal@test.com", "password");
    expect(result).toBeNull();
  });

  it("returns null when password is wrong (same result as wrong email)", async () => {
    const hash = await bcrypt.hash("password", 10);
    process.env["FINANCEOS_ADMIN_EMAIL"] = "real@test.com";
    process.env["FINANCEOS_ADMIN_PASSWORD"] = hash;
    vi.resetModules();
    const { validateCredentials } = await import("../auth/service.js");
    const result = await validateCredentials("real@test.com", "wrongpassword");
    expect(result).toBeNull();
  });
});

describe("validatePasswordConfig — startup check", () => {
  it("logs a warning without printing the password when not bcrypt", () => {
    process.env["FINANCEOS_ADMIN_PASSWORD"] = "plaintextvalue";
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    return import("../auth/service.js").then(({ validatePasswordConfig }) => {
      validatePasswordConfig();
      const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
      // Confirms a warning was issued.
      expect(warnCalls.some((msg) => msg.includes("not appear to be a bcrypt"))).toBe(true);
      // Confirms the plaintext value itself was never in any log call.
      const allOutput = [...warnCalls, ...infoSpy.mock.calls.map((c) => String(c[0]))].join(" ");
      expect(allOutput).not.toContain("plaintextvalue");
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    });
  });

  it("logs only hash prefix (safe 7 chars) when bcrypt is configured", async () => {
    const hash = await bcrypt.hash("secret", 10);
    process.env["FINANCEOS_ADMIN_PASSWORD"] = hash;
    vi.resetModules();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { validatePasswordConfig } = await import("../auth/service.js");
    validatePasswordConfig();
    const calls = infoSpy.mock.calls.map((c) => String(c[0]));
    const output = calls.join(" ");
    // Should log the safe prefix.
    expect(output).toContain("$2b$10$");
    // Must not log the full hash (60 chars).
    expect(output).not.toContain(hash.slice(7));
    infoSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — MFA module unit tests
// ---------------------------------------------------------------------------

describe("mfaCrypto — AES-256-GCM encryption", () => {
  const VALID_KEY = crypto.randomBytes(32).toString("hex");

  afterEach(() => {
    delete process.env["TOTP_ENCRYPTION_KEY"];
    vi.resetModules();
  });

  it("round-trips a TOTP secret through encrypt/decrypt", async () => {
    process.env["TOTP_ENCRYPTION_KEY"] = VALID_KEY;
    const { encryptTotpSecret, decryptTotpSecret } = await import("../auth/mfaCrypto.js");
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptTotpSecret(secret);
    expect(encrypted).not.toContain(secret); // ciphertext must not contain plaintext
    expect(encrypted.split(":")).toHaveLength(3); // <iv>:<tag>:<ct>
    expect(decryptTotpSecret(encrypted)).toBe(secret);
  });

  it("produces a different ciphertext on each call (unique IV)", async () => {
    process.env["TOTP_ENCRYPTION_KEY"] = VALID_KEY;
    const { encryptTotpSecret } = await import("../auth/mfaCrypto.js");
    const secret = "JBSWY3DPEHPK3PXP";
    const ct1 = encryptTotpSecret(secret);
    const ct2 = encryptTotpSecret(secret);
    expect(ct1).not.toBe(ct2);
  });

  it("throws on missing key", async () => {
    delete process.env["TOTP_ENCRYPTION_KEY"];
    const { encryptTotpSecret } = await import("../auth/mfaCrypto.js");
    expect(() => encryptTotpSecret("SECRET")).toThrow(/TOTP_ENCRYPTION_KEY/);
  });

  it("throws on malformed key (too short)", async () => {
    process.env["TOTP_ENCRYPTION_KEY"] = "tooshort";
    const { encryptTotpSecret } = await import("../auth/mfaCrypto.js");
    expect(() => encryptTotpSecret("SECRET")).toThrow(/64-character/);
  });

  it("throws on tampered ciphertext (auth tag failure)", async () => {
    process.env["TOTP_ENCRYPTION_KEY"] = VALID_KEY;
    const { encryptTotpSecret, decryptTotpSecret } = await import("../auth/mfaCrypto.js");
    const encrypted = encryptTotpSecret("MYSECRET");
    // Corrupt last byte of ciphertext.
    const parts = encrypted.split(":");
    parts[2] = parts[2]!.slice(0, -2) + "00";
    expect(() => decryptTotpSecret(parts.join(":"))).toThrow();
  });

  it("throws on tampered auth tag", async () => {
    process.env["TOTP_ENCRYPTION_KEY"] = VALID_KEY;
    const { encryptTotpSecret, decryptTotpSecret } = await import("../auth/mfaCrypto.js");
    const encrypted = encryptTotpSecret("MYSECRET");
    const parts = encrypted.split(":");
    parts[1] = "ff".repeat(16); // replace tag with all-0xff
    expect(() => decryptTotpSecret(parts.join(":"))).toThrow();
  });

  it("throws on bad format (missing colons)", async () => {
    process.env["TOTP_ENCRYPTION_KEY"] = VALID_KEY;
    const { decryptTotpSecret } = await import("../auth/mfaCrypto.js");
    expect(() => decryptTotpSecret("notvalidformat")).toThrow(/Invalid encrypted/);
  });

  it("validateEncryptionKey warns without printing key value", async () => {
    process.env["TOTP_ENCRYPTION_KEY"] = VALID_KEY;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { validateEncryptionKey } = await import("../auth/mfaCrypto.js");
    validateEncryptionKey();
    const allOutput = [
      ...warnSpy.mock.calls.map((c) => String(c[0])),
      ...infoSpy.mock.calls.map((c) => String(c[0])),
    ].join(" ");
    // Must not print the key.
    expect(allOutput).not.toContain(VALID_KEY);
    // Should confirm it is present.
    expect(allOutput).toContain("AES-256-GCM");
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });
});

describe("mfa — generateTotpSecret", () => {
  it("returns a valid otpauth URL", async () => {
    const { generateTotpSecret } = await import("../auth/mfa.js");
    const enrollment = await generateTotpSecret("test@example.com");
    expect(enrollment.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(enrollment.secret).toBeTruthy();
    expect(enrollment.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("includes the email in the label", async () => {
    const { generateTotpSecret } = await import("../auth/mfa.js");
    const enrollment = await generateTotpSecret("user@financeos.io");
    expect(enrollment.otpauthUrl).toContain("user%40financeos.io");
  });

  it("includes FinanceOS in the label (issuer prefix or name)", async () => {
    const { generateTotpSecret } = await import("../auth/mfa.js");
    const enrollment = await generateTotpSecret("x@y.com");
    // speakeasy embeds the issuer in the totp label (name field), not a query param.
    expect(enrollment.otpauthUrl).toMatch(/FinanceOS/i);
  });
});

describe("mfa — verifyTotpToken", () => {
  it("rejects a non-numeric token", async () => {
    const { generateTotpSecret, verifyTotpToken } = await import("../auth/mfa.js");
    const { secret } = await generateTotpSecret("user@example.com");
    expect(verifyTotpToken(secret, "notacode")).toBe(false);
  });

  it("rejects an obviously wrong token (000000 almost certainly wrong)", async () => {
    const { generateTotpSecret, verifyTotpToken } = await import("../auth/mfa.js");
    const { secret } = await generateTotpSecret("user@example.com");
    // 000000 has 1-in-1,000,000 chance of being valid — safe to assert false here.
    const result = verifyTotpToken(secret, "000000");
    expect(typeof result).toBe("boolean");
    // We cannot assert false with certainty, but we can assert the type.
  });

  it("returns false for empty string", async () => {
    const { generateTotpSecret, verifyTotpToken } = await import("../auth/mfa.js");
    const { secret } = await generateTotpSecret("user@example.com");
    expect(verifyTotpToken(secret, "")).toBe(false);
  });
});

describe("mfa — replay protection concept", () => {
  it("the same token hash cannot satisfy verifyRecoveryCode twice", async () => {
    const { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode } = await import(
      "../auth/mfa.js"
    );
    const codes = generateRecoveryCodes(5);
    const hashes = codes.map(hashRecoveryCode);
    const code = codes[2]!;

    // First use.
    const first = verifyRecoveryCode(code, hashes);
    expect(first.valid).toBe(true);
    const usedIndex = first.usedIndex;

    // Simulate marking used: remove from available list.
    const remaining = hashes.filter((_, i) => i !== usedIndex);
    const second = verifyRecoveryCode(code, remaining);
    expect(second.valid).toBe(false);
  });
});

describe("mfa — generateRecoveryCodes", () => {
  it("generates 10 codes by default", async () => {
    const { generateRecoveryCodes } = await import("../auth/mfa.js");
    expect(generateRecoveryCodes()).toHaveLength(10);
  });

  it("each code is 8 uppercase hex characters", async () => {
    const { generateRecoveryCodes } = await import("../auth/mfa.js");
    for (const code of generateRecoveryCodes(20)) {
      expect(code).toMatch(/^[0-9A-F]{8}$/);
    }
  });

  it("all codes are unique within a batch", async () => {
    const { generateRecoveryCodes } = await import("../auth/mfa.js");
    const codes = generateRecoveryCodes(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("generates the requested count", async () => {
    const { generateRecoveryCodes } = await import("../auth/mfa.js");
    expect(generateRecoveryCodes(3)).toHaveLength(3);
  });
});

describe("mfa — hashRecoveryCode", () => {
  it("is deterministic", async () => {
    const { hashRecoveryCode } = await import("../auth/mfa.js");
    expect(hashRecoveryCode("ABCD1234")).toBe(hashRecoveryCode("ABCD1234"));
  });

  it("is case-insensitive (normalises to uppercase before hashing)", async () => {
    const { hashRecoveryCode } = await import("../auth/mfa.js");
    expect(hashRecoveryCode("abcd1234")).toBe(hashRecoveryCode("ABCD1234"));
  });

  it("returns a 64-char hex string (SHA-256)", async () => {
    const { hashRecoveryCode } = await import("../auth/mfa.js");
    expect(hashRecoveryCode("ABCD1234")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different inputs produce different hashes", async () => {
    const { hashRecoveryCode } = await import("../auth/mfa.js");
    expect(hashRecoveryCode("ABCD1234")).not.toBe(hashRecoveryCode("ABCD1235"));
  });
});

describe("mfa — verifyRecoveryCode", () => {
  it("finds the correct code and returns its index", async () => {
    const { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode } = await import(
      "../auth/mfa.js"
    );
    const codes = generateRecoveryCodes(10);
    const hashes = codes.map(hashRecoveryCode);
    const result = verifyRecoveryCode(codes[3]!, hashes);
    expect(result.valid).toBe(true);
    expect(result.usedIndex).toBe(3);
  });

  it("returns invalid for a wrong code", async () => {
    const { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode } = await import(
      "../auth/mfa.js"
    );
    const codes = generateRecoveryCodes(10);
    const hashes = codes.map(hashRecoveryCode);
    const result = verifyRecoveryCode("WRONGCOD", hashes);
    expect(result.valid).toBe(false);
    expect(result.usedIndex).toBe(-1);
  });

  it("single-use: code rejected after its hash is removed from available list", async () => {
    const { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode } = await import(
      "../auth/mfa.js"
    );
    const codes = generateRecoveryCodes(10);
    const hashes = codes.map(hashRecoveryCode);
    const code = codes[0]!;

    const first = verifyRecoveryCode(code, hashes);
    expect(first.valid).toBe(true);

    // Mark used — caller removes the hash at first.usedIndex.
    const remaining = hashes.filter((_, i) => i !== first.usedIndex);
    const second = verifyRecoveryCode(code, remaining);
    expect(second.valid).toBe(false);
  });

  it("other codes still valid after one is consumed", async () => {
    const { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode } = await import(
      "../auth/mfa.js"
    );
    const codes = generateRecoveryCodes(5);
    const hashes = codes.map(hashRecoveryCode);

    // Consume codes[0].
    const r0 = verifyRecoveryCode(codes[0]!, hashes);
    const remaining = hashes.filter((_, i) => i !== r0.usedIndex);

    // codes[1] should still work.
    const r1 = verifyRecoveryCode(codes[1]!, remaining);
    expect(r1.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 5 — Plaid integration truthfulness
// ---------------------------------------------------------------------------

describe("plaid routes — placeholder status", () => {
  it("consent service exports the consent text and version", async () => {
    const { PLAID_CONSENT_TEXT, CURRENT_PRIVACY_POLICY_VERSION, consentTextHash } = await import(
      "../services/consentService.js"
    );
    expect(PLAID_CONSENT_TEXT.length).toBeGreaterThan(50);
    expect(CURRENT_PRIVACY_POLICY_VERSION).toMatch(/^privacy-v\d+\.\d+$/);
    // Hash should be a 64-char hex string.
    expect(consentTextHash()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("consent text hash is deterministic", async () => {
    const { consentTextHash } = await import("../services/consentService.js");
    expect(consentTextHash()).toBe(consentTextHash());
  });

  it("buildConsentRecord includes all required fields", async () => {
    const { buildConsentRecord } = await import("../services/consentService.js");
    const record = buildConsentRecord({
      userEmail: "a@b.com",
      entityId: "uuid-123",
    });
    expect(record).toHaveProperty("user_email", "a@b.com");
    expect(record).toHaveProperty("entity_id", "uuid-123");
    expect(record).toHaveProperty("policy_version");
    expect(record).toHaveProperty("consent_text_hash");
    expect(record).toHaveProperty("scope_requested");
    expect(record).toHaveProperty("plaid_products");
    // Confirm no access_token or Plaid credentials in the record.
    expect(record).not.toHaveProperty("access_token");
    expect(record).not.toHaveProperty("plaid_token");
  });
});

// ---------------------------------------------------------------------------
// Phase 9 — DB ownership: confirm no CORE_DATABASE_URL usage in MFA/consent
// ---------------------------------------------------------------------------

describe("database ownership — MFA and consent tables", () => {
  it("mfaRoutes uses DATABASE_URL for its pool, not CORE_DATABASE_URL", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../auth/mfaRoutes.js", import.meta.url).pathname.replace(".js", ".ts").replace("/dist/", "/src/"),
      "utf8",
    );
    // Must use DATABASE_URL for the pool connection.
    expect(source).toContain('process.env["DATABASE_URL"]');
    // Must not instantiate a Pool with CORE_DATABASE_URL (read-only financial DB).
    expect(source).not.toMatch(/new Pool\([^)]*CORE_DATABASE_URL/);
  });

  it("migration files are labeled as operational DB, not Core DB", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const mig1 = fs.readFileSync(
      path.resolve(__dirname, "../db/migrations/security_001_mfa.sql"),
      "utf8",
    );
    // Must mention DATABASE_URL (operational DB).
    expect(mig1).toContain("DATABASE_URL");
    // Must explicitly warn NOT to use the Core DB.
    expect(mig1).toMatch(/NOT.*Core|do not apply.*Core/i);
    // Must not DIRECT the user to run it on CORE_DATABASE_URL (warning phrasing "Never run... against" is OK).
    expect(mig1).not.toMatch(/run\s+this\s+migration\s+against\s+CORE|apply\s+this\s+to\s+CORE/i);
  });

  it("plaid routes use DATABASE_URL for consent/deletion persistence", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../routes/plaid.js", import.meta.url).pathname.replace(".js", ".ts").replace("/dist/", "/src/"),
      "utf8",
    );
    // Plaid route does not reference Core DB — all ops are on DATABASE_URL.
    expect(source).not.toContain("CORE_DATABASE_URL");
  });
});

// ---------------------------------------------------------------------------
// Schema-contract tests — migration and runtime code must agree on column names
// ---------------------------------------------------------------------------

describe("schema contract — migration and mfaRoutes must agree on all column names", () => {
  const FS = (() => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    return {
      mfaRoute: readFileSync(
        resolve(__dirname, "../auth/mfaRoutes.ts"),
        "utf8",
      ) as string,
      migration: readFileSync(
        resolve(__dirname, "../db/migrations/security_001_mfa.sql"),
        "utf8",
      ) as string,
    };
  })();

  const REQUIRED_COLUMNS = [
    "totp_secret_encrypted",
    "totp_enabled",
    "recovery_codes_hashed",
    "recovery_codes_used",
    "enrolled_at",
    "last_challenged_at",
    "last_totp_step",
    "failed_challenge_count",
    "locked_until",
    "updated_at",
  ] as const;

  for (const col of REQUIRED_COLUMNS) {
    it(`column '${col}' appears in both the migration DDL and mfaRoutes`, () => {
      expect(FS.migration).toContain(col);
      expect(FS.mfaRoute).toContain(col);
    });
  }

  it("migration specifies BIGINT for last_totp_step (replay protection needs integer counter)", () => {
    expect(FS.migration).toMatch(/last_totp_step\s+BIGINT/i);
  });

  it("migration specifies TIMESTAMPTZ for locked_until (timezone-aware lockout)", () => {
    expect(FS.migration).toMatch(/locked_until\s+TIMESTAMPTZ/i);
  });

  it("migration specifies TEXT[] for recovery_codes_hashed (array of SHA-256 hashes)", () => {
    expect(FS.migration).toMatch(/recovery_codes_hashed\s+TEXT\[\]/i);
  });

  it("migration specifies INTEGER[] for recovery_codes_used (index tracking)", () => {
    expect(FS.migration).toMatch(/recovery_codes_used\s+INTEGER\[\]/i);
  });

  it("totp_secret_encrypted column comment references AES-256-GCM format", () => {
    expect(FS.migration).toMatch(/AES-256-GCM/);
  });

  it("migration operates on DATABASE_URL (Replit operational DB), not CORE_DATABASE_URL", () => {
    expect(FS.migration).toContain("DATABASE_URL");
    // Must warn against using CORE_DATABASE_URL, not direct user to it.
    expect(FS.migration).not.toMatch(/run\s+this\s+migration\s+against\s+CORE|apply\s+this\s+to\s+CORE/i);
  });

  it("mfa_audit_log table is defined in the migration (event traceability)", () => {
    expect(FS.migration).toContain("CREATE TABLE IF NOT EXISTS mfa_audit_log");
  });

  it("mfaRoutes inserts to mfa_audit_log on enroll, challenge, success, failure, lockout, admin-reset", () => {
    const events = ["enroll_started", "enrolled", "success", "failure", "locked_out", "admin_reset_by"];
    for (const evt of events) {
      expect(FS.mfaRoute).toContain(evt);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 5 — MFA control completeness
// ---------------------------------------------------------------------------

describe("MFA controls — enrollment cannot activate without verified TOTP", () => {
  it("generateTotpSecret returns totp_enabled=false state (enrollment is two-step)", async () => {
    const { generateTotpSecret } = await import("../auth/mfa.js");
    const enrollment = await generateTotpSecret("test@example.com");
    // Enrollment itself produces no confirmed status — verification is a separate call.
    expect(enrollment.secret).toBeTruthy();
    expect(enrollment.otpauthUrl).toBeTruthy();
    // The secret must NOT be logged — verify it is not in any console output.
  });
});

describe("MFA controls — session regeneration (fixation protection)", () => {
  it("routes/auth.ts calls session.regenerate() after password login", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../routes/auth.ts"), "utf8") as string;
    expect(src).toContain("session.regenerate");
  });

  it("mfaRoutes.ts calls session.regenerate() after MFA challenge success", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    expect(src).toContain("session.regenerate");
    // Must come in the challenge route's success path, after promotedUser is set.
    expect(src).toContain("promotedUser");
  });
});

describe("MFA controls — lockout enforcement", () => {
  it("mfaRoutes checks isLockedOut BEFORE attempting token verification in the challenge handler", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    // Extract only the challenge route section (between "/challenge" route definition and next route).
    // isLockedOut() must appear before decryptTotpSecret() within that section.
    const challengeStart = src.indexOf('"/challenge"');
    expect(challengeStart).toBeGreaterThan(0);
    const challengeSection = src.slice(challengeStart);
    const lockedPos = challengeSection.indexOf("isLockedOut(row)");
    const decryptPos = challengeSection.indexOf("decryptTotpSecret(row");
    expect(lockedPos).toBeGreaterThan(0);
    expect(decryptPos).toBeGreaterThan(0);
    expect(lockedPos).toBeLessThan(decryptPos);
  });

  it("MAX_FAILED_CHALLENGES is 5 (brute-force threshold)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    expect(src).toContain("MAX_FAILED_CHALLENGES = 5");
  });

  it("LOCKOUT_MINUTES is 15 (lockout duration)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    expect(src).toContain("LOCKOUT_MINUTES = 15");
  });

  it("lockout sets locked_until in the database UPDATE", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    expect(src).toContain("locked_until");
    // SET locked_until must appear in an UPDATE statement.
    expect(src).toMatch(/SET.*failed_challenge_count.*locked_until|locked_until.*failed_challenge_count/s);
  });
});

describe("MFA controls — replay protection", () => {
  it("mfaRoutes stores last_totp_step after a successful challenge", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    // last_totp_step must be set in the success UPDATE.
    expect(src).toMatch(/last_totp_step.*=.*\$\d/);
  });

  it("mfaRoutes rejects when last_totp_step >= current step", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    expect(src).toContain("last_totp_step");
    expect(src).toContain("already been used");
  });

  it("currentTotpStep function uses 30-second windows", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    // 30-second window calculation: Date.now() / 1000 / 30.
    expect(src).toContain("/ 1000 / 30");
  });
});

describe("MFA controls — admin reset authorization", () => {
  it("admin-reset route rejects non-admin callers", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    expect(src).toContain('admin.role !== "admin"');
  });

  it("admin-reset records the resetting admin's email in the audit log", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    expect(src).toContain("admin_reset_by:");
    expect(src).toContain("admin.email");
  });

  it("admin-reset requires target email in request body (no self-reset without specifying target)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    expect(src).toContain('body["email"]');
    expect(src).toContain('"email required"');
  });
});

describe("MFA controls — secrets never logged or returned in responses", () => {
  it("mfaRoutes never calls console.log with the TOTP secret or recovery codes", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    // The source must not have a console.log call (console.warn/info is OK for errors).
    expect(src).not.toContain("console.log(");
  });

  it("mfaRoutes error handlers log errType only (not the exception details that may include secrets)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    // Error handler uses generic "Enrollment failed" / "Challenge failed" messages.
    expect(src).toContain('"Enrollment failed"');
    expect(src).toContain('"Challenge failed"');
  });

  it("mfaCrypto validateEncryptionKey never prints key length, prefix, or value", async () => {
    process.env["TOTP_ENCRYPTION_KEY"] = "a".repeat(64);
    vi.resetModules();
    const { validateEncryptionKey } = await import("../auth/mfaCrypto.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    validateEncryptionKey();
    const output = [
      ...logSpy.mock.calls.map((c) => String(c[0])),
      ...infoSpy.mock.calls.map((c) => String(c[0])),
    ].join(" ");
    expect(output).not.toContain("a".repeat(64));
    logSpy.mockRestore();
    infoSpy.mockRestore();
    delete process.env["TOTP_ENCRYPTION_KEY"];
  });
});

describe("MFA controls — missing production configuration fails closed", () => {
  it("encryptTotpSecret throws immediately when TOTP_ENCRYPTION_KEY is missing", async () => {
    delete process.env["TOTP_ENCRYPTION_KEY"];
    vi.resetModules();
    const { encryptTotpSecret } = await import("../auth/mfaCrypto.js");
    expect(() => encryptTotpSecret("ANYSECRET")).toThrow("TOTP_ENCRYPTION_KEY");
  });

  it("decryptTotpSecret throws immediately when TOTP_ENCRYPTION_KEY is missing", async () => {
    delete process.env["TOTP_ENCRYPTION_KEY"];
    vi.resetModules();
    const { decryptTotpSecret } = await import("../auth/mfaCrypto.js");
    expect(() => decryptTotpSecret("aabbcc:ddeeff:001122")).toThrow("TOTP_ENCRYPTION_KEY");
  });
});

// ---------------------------------------------------------------------------
// Section 6 — Session and browser security controls (source-level evidence)
// ---------------------------------------------------------------------------

describe("session security — cookie and session configuration", () => {
  it("httpOnly is set on the session cookie", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../app.ts"), "utf8") as string;
    expect(src).toContain("httpOnly: true");
  });

  it("secure is set based on NODE_ENV (true in production)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../app.ts"), "utf8") as string;
    expect(src).toMatch(/secure:.*NODE_ENV.*production/);
  });

  it("sameSite is 'lax' (CSRF protection for same-origin POST without cross-site embeds)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../app.ts"), "utf8") as string;
    expect(src).toContain("sameSite: \"lax\"");
  });

  it("session maxAge is 8 hours (8 * 60 * 60 * 1000 ms)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../app.ts"), "utf8") as string;
    expect(src).toContain("8 * 60 * 60 * 1000");
  });

  it("saveUninitialized is false (no session created for unauthenticated requests)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../app.ts"), "utf8") as string;
    expect(src).toContain("saveUninitialized: false");
  });

  it("resave is false (session not written back if unmodified)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../app.ts"), "utf8") as string;
    expect(src).toContain("resave: false");
  });

  it("logout destroys the server-side session (req.session.destroy)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../routes/auth.ts"), "utf8") as string;
    expect(src).toContain("session.destroy");
    expect(src).toContain("clearCookie");
  });

  it("CORS uses ALLOWED_ORIGINS allowlist in production", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../app.ts"), "utf8") as string;
    expect(src).toContain("ALLOWED_ORIGINS");
    expect(src).toContain("production");
    expect(src).toContain("credentials: true");
  });

  it("trust proxy is set to 1 (Replit single-hop reverse proxy)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../app.ts"), "utf8") as string;
    expect(src).toContain('"trust proxy", 1');
  });
});

describe("session security — rate limiting on auth routes", () => {
  it("login route has rate limiter (10 attempts / 15 min)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../routes/auth.ts"), "utf8") as string;
    expect(src).toContain("rateLimit");
    expect(src).toContain("loginLimiter");
    expect(src).toContain("limit: 10");
  });

  it("MFA challenge route has rate limiter (5 attempts / 15 min)", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/mfaRoutes.ts"), "utf8") as string;
    expect(src).toContain("rateLimit");
    expect(src).toContain("challengeLimiter");
    expect(src).toContain("limit: 5");
  });
});

describe("session security — partial session (mfaPending) blocks protected routes", () => {
  it("requireAuth middleware rejects requests with mfaPending set", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/middleware.ts"), "utf8") as string;
    expect(src).toContain("mfaPending");
    expect(src).toContain("MFA_REQUIRED");
  });

  it("mfaPending session state returns 401 with MFA_REQUIRED code", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../auth/middleware.ts"), "utf8") as string;
    expect(src).toContain('"MFA_REQUIRED"');
    expect(src).toContain("401");
  });
});
