/**
 * MFA secret encryption — AES-256-GCM authenticated encryption for TOTP secrets.
 *
 * The encryption key MUST come from the TOTP_ENCRYPTION_KEY environment variable:
 * a 64-character hex string representing 32 bytes (256 bits).
 *
 * Generate a key:
 *   node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
 * Store the output in Replit Secrets as TOTP_ENCRYPTION_KEY. Never commit it.
 *
 * Storage format (in DB column totp_secret_encrypted):
 *   "<hex-iv>:<hex-authTag>:<hex-ciphertext>"
 * All three parts are required to decrypt. Tampering with any part causes
 * decryption to throw, so the record is treated as corrupted and MFA fails closed.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV is recommended for GCM
const TAG_BYTES = 16; // 128-bit authentication tag

function getKey(): Buffer {
  const raw = process.env["TOTP_ENCRYPTION_KEY"];
  if (!raw) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: node -e \"process.stdout.write(require('crypto').randomBytes(32).toString('hex'))\" " +
        "and store it in Replit Secrets. Never commit it to source code.",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Re-generate it with the command above.",
    );
  }
  return Buffer.from(raw, "hex");
}

/**
 * encryptTotpSecret — encrypts a base32 TOTP secret with AES-256-GCM.
 * Returns a storage-safe string "<iv>:<tag>:<ciphertext>" (all hex).
 * Throws if TOTP_ENCRYPTION_KEY is missing or malformed.
 */
export function encryptTotpSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * decryptTotpSecret — decrypts a stored "<iv>:<tag>:<ciphertext>" string.
 * Returns the plaintext base32 TOTP secret.
 * Throws on key error, format error, or authentication failure (tampered data).
 */
export function decryptTotpSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted TOTP secret format — expected <iv>:<tag>:<ciphertext>");
  }
  const [ivHex, tagHex, ctHex] = parts as [string, string, string];
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");

  if (iv.length !== IV_BYTES) {
    throw new Error(`IV must be ${IV_BYTES} bytes; got ${iv.length}`);
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error(`Auth tag must be ${TAG_BYTES} bytes; got ${tag.length}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  // If the authentication tag does not match, decipher.final() throws — fail closed.
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/**
 * validateEncryptionKey — checks TOTP_ENCRYPTION_KEY at startup without printing it.
 * Call once from index.ts. Logs a confirmation or warning only.
 */
export function validateEncryptionKey(): void {
  const raw = process.env["TOTP_ENCRYPTION_KEY"];
  if (!raw) {
    console.warn(
      "[mfa] WARNING: TOTP_ENCRYPTION_KEY is not set. " +
        "TOTP enrollment and challenge will fail until this secret is provisioned in Replit Secrets.",
    );
    return;
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    console.warn(
      "[mfa] WARNING: TOTP_ENCRYPTION_KEY is present but not a valid 64-char hex string. " +
        "Re-generate and update Replit Secrets.",
    );
    return;
  }
  console.info("[mfa] TOTP_ENCRYPTION_KEY configured — AES-256-GCM key present (64-char hex OK)");
}
