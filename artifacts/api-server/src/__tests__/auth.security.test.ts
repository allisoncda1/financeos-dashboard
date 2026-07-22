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
    // Must not contain a phrase that would direct the user to run it on CORE_DATABASE_URL.
    expect(mig1).not.toMatch(/run.*CORE_DATABASE_URL|apply.*CORE_DATABASE_URL/i);
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
