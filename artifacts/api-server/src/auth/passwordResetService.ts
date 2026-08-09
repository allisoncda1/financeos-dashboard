/**
 * Password reset service — token generation, validation, and consumption.
 *
 * Security invariants:
 *   - Raw tokens are generated with crypto.randomBytes(32); NEVER stored.
 *   - Only the SHA-256 hex digest (token_hash) is persisted.
 *   - Tokens expire after 1 hour and are single-use (used_at set on consume).
 *   - Only active app_users can be reset. The env-var admin account cannot be
 *     reset through this flow.
 *   - No token, password, or hash is ever logged.
 *   - All tables live in DATABASE_URL (operational DB).
 */

import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const dbUrl = process.env["DATABASE_URL"];
const pool = dbUrl ? new Pool({ connectionString: dbUrl }) : null;

async function query<T extends object>(sql: string, params: unknown[]): Promise<{ rows: T[] }> {
  if (!pool) throw new Error("DATABASE_URL not configured — password reset service unavailable");
  return pool.query<T>(sql, params);
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a reset token for the given email IF an active app_user exists.
 * Returns the raw token (to embed in the email link) or null when no matching
 * user exists. Callers must respond identically in both cases to avoid
 * account enumeration.
 */
export async function createResetToken(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();

  const { rows: users } = await query<{ id: string }>(
    `SELECT id FROM app_users WHERE lower(email) = $1 AND status = 'active'`,
    [normalized],
  );
  if (users.length === 0) return null;

  // Invalidate any previous outstanding tokens for this email.
  await query(
    `UPDATE password_reset_tokens SET used_at = now()
     WHERE email = $1 AND used_at IS NULL AND expires_at > now()`,
    [normalized],
  );

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await query(
    `INSERT INTO password_reset_tokens (email, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [normalized, hashToken(rawToken), expiresAt],
  );

  return rawToken;
}

export type ResetTokenStatus =
  | { valid: true; email: string }
  | { valid: false; reason: "not_found" | "expired" | "used" };

/** Look up a raw token and report whether it is still usable. */
export async function validateResetToken(rawToken: string): Promise<ResetTokenStatus> {
  const { rows } = await query<{ email: string; expires_at: Date; used_at: Date | null }>(
    `SELECT email, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
    [hashToken(rawToken)],
  );
  const row = rows[0];
  if (!row) return { valid: false, reason: "not_found" };
  if (row.used_at) return { valid: false, reason: "used" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { valid: false, reason: "expired" };
  return { valid: true, email: row.email };
}

/**
 * Consume a token and set the user's new password (bcrypt cost 12).
 * Throws on invalid token or missing user.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<{ email: string }> {
  if (!pool) throw new Error("DATABASE_URL not configured — password reset service unavailable");

  // Hash before opening the transaction to keep it short.
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const tokenHash = hashToken(rawToken);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Atomically claim the token: the conditional UPDATE succeeds for exactly
    // one concurrent request; all others see zero rows. This is what enforces
    // the single-use guarantee — never split claim and password write.
    const claimed = await client.query<{ email: string }>(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING email`,
      [tokenHash],
    );
    const row = claimed.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      // Distinguish expired from invalid/used for the error message only.
      const status = await validateResetToken(rawToken);
      throw new Error(
        !status.valid && status.reason === "expired"
          ? "This reset link has expired. Please request a new one."
          : "This reset link is invalid or has already been used.",
      );
    }

    const updated = await client.query(
      `UPDATE app_users SET password_hash = $1, updated_at = now()
       WHERE lower(email) = $2 AND status = 'active'`,
      [passwordHash, row.email],
    );
    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");
      throw new Error("This account no longer exists or is disabled.");
    }

    await client.query("COMMIT");
    return { email: row.email };
  } catch (err) {
    // Ensure the transaction is not left open on unexpected errors.
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
