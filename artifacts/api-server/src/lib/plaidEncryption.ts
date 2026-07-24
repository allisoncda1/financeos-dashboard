/**
 * plaidEncryption.ts — AES-256-GCM encryption for Plaid access tokens.
 *
 * Uses the same pattern as mfaCrypto.ts (TOTP secret encryption).
 * Key comes from PLAID_TOKEN_ENCRYPTION_KEY env var: a 64-character hex
 * string (32 bytes). Generate with:
 *   node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
 * Store in Replit Secrets. Never commit it.
 *
 * Storage format — three separate DB columns:
 *   access_token_encrypted  TEXT  — hex-encoded AES-GCM ciphertext
 *   access_token_iv         TEXT  — hex-encoded 12-byte IV (96 bits, GCM standard)
 *   access_token_tag        TEXT  — hex-encoded 16-byte auth tag
 *
 * All three fields are required together to decrypt. Tampering with any
 * field causes decryption to throw (GCM authentication failure), so the
 * connection is treated as corrupted and Plaid operations fail closed.
 *
 * SECURITY INVARIANTS:
 *  - Never log plaintext access_token or the key bytes.
 *  - Never return the plaintext access_token in an HTTP response.
 *  - Use a fresh random IV per encryption call (never reuse IVs with GCM).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;   // 96-bit IV — GCM recommendation
const TAG_BYTES = 16;  // 128-bit authentication tag

function getEncryptionKey(): Buffer {
  const raw = process.env["PLAID_TOKEN_ENCRYPTION_KEY"];
  if (!raw) {
    throw new Error(
      "PLAID_TOKEN_ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: node -e \"process.stdout.write(require('crypto').randomBytes(32).toString('hex'))\" " +
        "and store it in Replit Secrets. Never commit it to source code.",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "PLAID_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Re-generate it and update Replit Secrets.",
    );
  }
  return Buffer.from(raw, "hex");
}

export interface EncryptedToken {
  encrypted: string;  // hex-encoded ciphertext
  iv: string;         // hex-encoded 12-byte IV
  tag: string;        // hex-encoded 16-byte GCM auth tag
}

/**
 * encryptAccessToken — encrypts a Plaid access_token with AES-256-GCM.
 * Returns three separate hex strings to be stored in three DB columns.
 * Throws if PLAID_TOKEN_ENCRYPTION_KEY is missing or malformed.
 */
export function encryptAccessToken(token: string): EncryptedToken {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

/**
 * decryptAccessToken — decrypts the three-field AES-256-GCM ciphertext.
 * Returns the plaintext Plaid access_token string.
 * Throws on key error, format error, or GCM authentication failure.
 * NEVER log the return value.
 */
export function decryptAccessToken(encrypted: string, iv: string, tag: string): string {
  const key = getEncryptionKey();
  const ivBuf = Buffer.from(iv, "hex");
  const tagBuf = Buffer.from(tag, "hex");
  const ctBuf = Buffer.from(encrypted, "hex");

  if (ivBuf.length !== IV_BYTES) {
    throw new Error(`IV must be ${IV_BYTES} bytes; got ${ivBuf.length}`);
  }
  if (tagBuf.length !== TAG_BYTES) {
    throw new Error(`Auth tag must be ${TAG_BYTES} bytes; got ${tagBuf.length}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(tagBuf);
  // GCM authentication: decipher.final() throws if the tag doesn't match — fail closed.
  return Buffer.concat([decipher.update(ctBuf), decipher.final()]).toString("utf8");
}

/**
 * validatePlaidEncryptionKey — call once at startup.
 * Logs presence/absence without printing the key value.
 */
export function validatePlaidEncryptionKey(): void {
  const raw = process.env["PLAID_TOKEN_ENCRYPTION_KEY"];
  if (!raw) {
    console.warn(
      "[plaid] WARNING: PLAID_TOKEN_ENCRYPTION_KEY is not set. " +
        "exchange-token and sync routes will fail until this secret is provisioned.",
    );
    return;
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    console.warn(
      "[plaid] WARNING: PLAID_TOKEN_ENCRYPTION_KEY is present but not a valid 64-char hex string.",
    );
    return;
  }
  console.info("[plaid] PLAID_TOKEN_ENCRYPTION_KEY configured — AES-256-GCM key present (64-char hex OK)");
}
