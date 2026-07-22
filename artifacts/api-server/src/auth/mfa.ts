/**
 * TOTP MFA service — speakeasy-backed TOTP generation and verification,
 * plus recovery code generation and hashing.
 *
 * Never logs or returns raw secrets or plaintext recovery codes after
 * the initial enrollment response.
 */

import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { createHash, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// TOTP
// ---------------------------------------------------------------------------

export interface TotpEnrollment {
  /** Base32-encoded secret — must be encrypted before storing in DB. */
  secret: string;
  /** otpauth:// URL for manual entry into authenticator apps. */
  otpauthUrl: string;
  /** Data URI PNG of the QR code — send to frontend, do not persist. */
  qrDataUrl: string;
}

/**
 * generateTotpSecret — creates a new TOTP secret for the given email.
 * Returns the raw secret (for client display only), the otpauth URL, and
 * a QR code data URI. The secret must be AES-256-GCM encrypted before
 * being stored in user_mfa.totp_secret_encrypted.
 */
export async function generateTotpSecret(email: string): Promise<TotpEnrollment> {
  const generated = speakeasy.generateSecret({
    name: `FinanceOS (${email})`,
    issuer: "FinanceOS",
    length: 20,
  });

  const otpauthUrl = generated.otpauth_url ?? "";
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  return {
    secret: generated.base32,
    otpauthUrl,
    qrDataUrl,
  };
}

/**
 * verifyTotpToken — checks a 6-digit TOTP token against the stored base32
 * secret. window:1 allows one 30-second step of clock drift (±30 s).
 */
export function verifyTotpToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1,
  });
}

// ---------------------------------------------------------------------------
// Recovery codes
// ---------------------------------------------------------------------------

const DEFAULT_CODE_COUNT = 10;
const CODE_BYTES = 5; // 5 random bytes → 10 uppercase hex chars (8 would be 4 bytes)

/**
 * generateRecoveryCodes — produces `count` single-use recovery codes.
 * Each code is 8 uppercase alphanumeric characters (random, not sequential).
 * Returns plaintext codes — present to the user ONCE and never store them.
 * Store only their SHA-256 hashes (see hashRecoveryCode).
 */
export function generateRecoveryCodes(count: number = DEFAULT_CODE_COUNT): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(CODE_BYTES).toString("hex").toUpperCase().slice(0, 8),
  );
}

/**
 * hashRecoveryCode — deterministic SHA-256 hex hash of a recovery code.
 * Always uppercase-normalise the submitted code before hashing so
 * casing differences are handled gracefully.
 */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase().trim()).digest("hex");
}

/**
 * verifyRecoveryCode — checks a submitted code against the stored hash list.
 * Returns { valid: true, usedIndex: N } if found, { valid: false, usedIndex: -1 } otherwise.
 * The caller is responsible for removing hashes[usedIndex] from the stored list
 * (or tracking used indices) to ensure single-use semantics.
 */
export function verifyRecoveryCode(
  submitted: string,
  hashes: string[],
): { valid: boolean; usedIndex: number } {
  const submittedHash = hashRecoveryCode(submitted);
  const usedIndex = hashes.findIndex((h) => h === submittedHash);
  if (usedIndex === -1) {
    return { valid: false, usedIndex: -1 };
  }
  return { valid: true, usedIndex };
}
