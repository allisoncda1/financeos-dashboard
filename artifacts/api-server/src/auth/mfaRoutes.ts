/**
 * MFA Routes — TOTP enrollment, challenge, recovery code management.
 *
 * Session state during login with MFA:
 *   1. POST /api/auth/login → password OK, MFA enabled → sets session.mfaPending +
 *      session.pendingUser, returns 202. session.regenerate() is called first.
 *   2. POST /api/auth/mfa/challenge → TOTP or recovery code verified →
 *      session.regenerate() called, then session.user set. Clears pending state.
 *
 * Security invariants enforced here:
 *   - TOTP secrets are AES-256-GCM encrypted at rest (mfaCrypto.ts)
 *   - No secret, QR payload, or plaintext recovery code is ever logged
 *   - Generic error messages (no oracle about what failed)
 *   - Challenge rate-limited: 5 attempts / 15 min per IP
 *   - Lockout enforced: after 5 consecutive failures, locked for 15 min
 *   - Replay protection: last used TOTP step stored; same step rejected
 *   - Recovery codes: SHA-256 hashed, single-use, verified before activation
 *   - session.regenerate() called after MFA challenge success (prevents fixation)
 *   - All tables belong to DATABASE_URL (operational DB), not CORE_DATABASE_URL
 */

import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Pool } from "pg";
import {
  generateTotpSecret,
  verifyTotpToken,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
} from "./mfa.js";
import { encryptTotpSecret, decryptTotpSecret } from "./mfaCrypto.js";
import { requireAuth, requireMfaEnrollment } from "./middleware.js";
import type { AuthUser } from "./types.js";

// ---------------------------------------------------------------------------
// DB pool — DATABASE_URL is the Dashboard operational database (sessions, MFA,
// consent). NEVER use CORE_DATABASE_URL here; that is read-only financial data.
// ---------------------------------------------------------------------------

const dbUrl = process.env["DATABASE_URL"];
const pool = dbUrl ? new Pool({ connectionString: dbUrl }) : null;

async function query<T extends object>(
  sql: string,
  params: unknown[],
): Promise<{ rows: T[] }> {
  if (!pool) throw new Error("DATABASE_URL not configured — MFA unavailable");
  return pool.query<T>(sql, params);
}

// ---------------------------------------------------------------------------
// Lockout constants
// ---------------------------------------------------------------------------

const MAX_FAILED_CHALLENGES = 5;
const LOCKOUT_MINUTES = 15;

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

interface MfaRow {
  totp_secret_encrypted: string | null;
  totp_enabled: boolean;
  recovery_codes_hashed: string[] | null;
  recovery_codes_used: number[] | null;
  enrolled_at: string | null;
  failed_challenge_count: number;
  locked_until: string | null;
  last_totp_step: number | null;
}

async function getMfaRow(email: string): Promise<MfaRow | null> {
  const res = await query<MfaRow>(
    `SELECT totp_secret_encrypted, totp_enabled, recovery_codes_hashed,
            recovery_codes_used, enrolled_at, failed_challenge_count,
            locked_until, last_totp_step
     FROM user_mfa WHERE user_email = $1`,
    [email],
  );
  return res.rows[0] ?? null;
}

async function logMfaEvent(
  email: string,
  eventType: string,
  ip: string | undefined,
  ua: string | undefined,
): Promise<void> {
  await query(
    `INSERT INTO mfa_audit_log (user_email, event_type, ip_address, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [email, eventType, ip ?? null, ua ?? null],
  );
}

/**
 * isLockedOut — returns true if locked_until is set and is in the future.
 */
function isLockedOut(row: MfaRow): boolean {
  if (!row.locked_until) return false;
  return new Date(row.locked_until) > new Date();
}

/**
 * lockoutSecondsRemaining — seconds until the lockout expires (0 if not locked).
 */
function lockoutSecondsRemaining(row: MfaRow): number {
  if (!row.locked_until) return 0;
  const diff = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
}

/**
 * currentTotpStep — returns the current 30-second TOTP counter value.
 * Used for replay detection: if the incoming token's step matches last_totp_step,
 * it has already been consumed.
 */
function currentTotpStep(): number {
  return Math.floor(Date.now() / 1000 / 30);
}

/**
 * getUserMfaStatus — exported for use in routes/auth.ts to check MFA state
 * after password validation without importing the whole router.
 */
export async function getUserMfaStatus(
  email: string,
): Promise<{ totpEnabled: boolean; enrolledAt: string | null; recoveryCodesRemaining: number }> {
  const row = await getMfaRow(email);
  if (!row) {
    return { totpEnabled: false, enrolledAt: null, recoveryCodesRemaining: 0 };
  }
  const used = row.recovery_codes_used?.length ?? 0;
  const total = row.recovery_codes_hashed?.length ?? 0;
  return {
    totpEnabled: row.totp_enabled,
    enrolledAt: row.enrolled_at,
    recoveryCodesRemaining: total - used,
  };
}

// ---------------------------------------------------------------------------
// Rate limiter for the challenge endpoint
// ---------------------------------------------------------------------------

const challengeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  handler: (_req, res) => {
    res.status(429).json({
      ok: false,
      error: "Too many MFA attempts. Please try again later.",
      ts: new Date().toISOString(),
    });
  },
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

// GET /api/auth/mfa/status
router.get("/status", requireAuth, async (req, res) => {
  const user = req.session.user!;
  try {
    const status = await getUserMfaStatus(user.email);
    res.json({ ok: true, data: status, ts: new Date().toISOString() });
  } catch {
    res.status(500).json({ ok: false, error: "Unable to retrieve MFA status", ts: new Date().toISOString() });
  }
});

// POST /api/auth/mfa/enroll/totp — begin enrollment
router.post("/enroll/totp", requireMfaEnrollment, async (req, res) => {
  const user = req.session.user!;
  try {
    const enrollment = await generateTotpSecret(user.email);

    // Encrypt the TOTP secret before storing. encryptTotpSecret throws if
    // TOTP_ENCRYPTION_KEY is missing or malformed — enrollment fails closed.
    const encryptedSecret = encryptTotpSecret(enrollment.secret);

    // Store with totp_enabled = false until the user confirms a valid code.
    await query(
      `INSERT INTO user_mfa (user_email, totp_secret_encrypted, totp_enabled)
       VALUES ($1, $2, false)
       ON CONFLICT (user_email) DO UPDATE
         SET totp_secret_encrypted = EXCLUDED.totp_secret_encrypted,
             totp_enabled = false,
             failed_challenge_count = 0,
             locked_until = null,
             last_totp_step = null,
             updated_at = now()`,
      [user.email, encryptedSecret],
    );

    await logMfaEvent(user.email, "enroll_started", req.ip, req.headers["user-agent"]);

    // Return secret + QR code to frontend. These values are never logged.
    res.json({
      ok: true,
      data: {
        secret: enrollment.secret,
        otpauthUrl: enrollment.otpauthUrl,
        qrDataUrl: enrollment.qrDataUrl,
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    // Log error type only — never the encryption key or secret.
    const msg = err instanceof Error ? err.message : "unknown";
    req.log?.warn({ errType: msg.includes("TOTP_ENCRYPTION_KEY") ? "key_config" : "enroll" }, "TOTP enrollment error");
    res.status(500).json({ ok: false, error: "Enrollment failed", ts: new Date().toISOString() });
  }
});

// POST /api/auth/mfa/enroll/totp/verify — activate TOTP after scanning QR
router.post("/enroll/totp/verify", requireMfaEnrollment, async (req, res) => {
  const user = req.session.user!;
  const body = req.body as Record<string, unknown>;
  const token = typeof body["token"] === "string" ? body["token"].trim() : "";

  if (!token) {
    res.status(400).json({ ok: false, error: "Token required", ts: new Date().toISOString() });
    return;
  }

  try {
    const row = await getMfaRow(user.email);
    if (!row?.totp_secret_encrypted) {
      res.status(400).json({ ok: false, error: "No pending enrollment found", ts: new Date().toISOString() });
      return;
    }

    // Decrypt before verifying.
    const plainSecret = decryptTotpSecret(row.totp_secret_encrypted);
    const step = currentTotpStep();
    const valid = verifyTotpToken(plainSecret, token);

    if (!valid) {
      res.status(401).json({ ok: false, error: "Invalid code", ts: new Date().toISOString() });
      return;
    }

    // Generate recovery codes — return plaintext once, store only hashes.
    const codes = generateRecoveryCodes(10);
    const hashes = codes.map(hashRecoveryCode);

    await query(
      `UPDATE user_mfa
       SET totp_enabled = true,
           recovery_codes_hashed = $2,
           recovery_codes_used = '{}',
           enrolled_at = now(),
           last_totp_step = $3,
           updated_at = now()
       WHERE user_email = $1`,
      [user.email, hashes, step],
    );

    await logMfaEvent(user.email, "enrolled", req.ip, req.headers["user-agent"]);

    // Enrollment is now complete. Regenerate again at the authentication-state
    // boundary, then promote the same user into a fully authenticated session.
    const promotedUser = user;
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.user = promotedUser;

    // Return plaintext codes ONCE — frontend must prompt user to save them.
    // These are never logged.
    res.json({
      ok: true,
      data: { recoveryCodes: codes },
      ts: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Verification failed", ts: new Date().toISOString() });
  }
});

// POST /api/auth/mfa/challenge — called after password login when mfaPending
router.post("/challenge", challengeLimiter, async (req, res) => {
  // Must have a pending MFA session (password done, MFA not yet verified).
  if (!req.session.mfaPending || !req.session.pendingUser) {
    res.status(401).json({ ok: false, error: "No pending MFA session", ts: new Date().toISOString() });
    return;
  }

  const pendingUser: AuthUser = req.session.pendingUser;
  const body = req.body as Record<string, unknown>;
  const token = typeof body["token"] === "string" ? body["token"].trim() : "";
  const recoveryCode = typeof body["recoveryCode"] === "string" ? body["recoveryCode"].trim() : "";

  if (!token && !recoveryCode) {
    res.status(400).json({ ok: false, error: "Token or recovery code required", ts: new Date().toISOString() });
    return;
  }

  try {
    const row = await getMfaRow(pendingUser.email);
    if (!row?.totp_enabled || !row.totp_secret_encrypted) {
      res.status(400).json({ ok: false, error: "MFA not configured for this account", ts: new Date().toISOString() });
      return;
    }

    // Enforce lockout BEFORE attempting verification — fail closed.
    if (isLockedOut(row)) {
      const secs = lockoutSecondsRemaining(row);
      await logMfaEvent(pendingUser.email, "locked_out", req.ip, req.headers["user-agent"]);
      res.status(429).json({
        ok: false,
        error: `Account temporarily locked. Try again in ${Math.ceil(secs / 60)} minute(s).`,
        ts: new Date().toISOString(),
      });
      return;
    }

    let challengeOk = false;
    const step = currentTotpStep();

    if (token) {
      // Replay protection: reject if this TOTP step was already used.
      if (row.last_totp_step !== null && row.last_totp_step >= step) {
        res.status(401).json({
          ok: false,
          error: "This code has already been used. Wait for the next 30-second window.",
          ts: new Date().toISOString(),
        });
        return;
      }

      const plainSecret = decryptTotpSecret(row.totp_secret_encrypted);
      challengeOk = verifyTotpToken(plainSecret, token);

      if (challengeOk) {
        await query(
          `UPDATE user_mfa
           SET last_challenged_at = now(),
               last_totp_step = $2,
               failed_challenge_count = 0,
               locked_until = null,
               updated_at = now()
           WHERE user_email = $1`,
          [pendingUser.email, step],
        );
        await logMfaEvent(pendingUser.email, "success", req.ip, req.headers["user-agent"]);
      }
    } else if (recoveryCode) {
      const hashes = row.recovery_codes_hashed ?? [];
      const usedIndices = new Set(row.recovery_codes_used ?? []);

      // Build a map from available hash → original index for single-use enforcement.
      const available: Array<{ hash: string; index: number }> = hashes
        .map((hash, index) => ({ hash, index }))
        .filter(({ index }) => !usedIndices.has(index));

      const submittedHash = hashRecoveryCode(recoveryCode);
      const matched = available.find(({ hash }) => hash === submittedHash);

      if (matched !== undefined) {
        await query(
          `UPDATE user_mfa
           SET recovery_codes_used = array_append(recovery_codes_used, $2),
               last_challenged_at = now(),
               failed_challenge_count = 0,
               locked_until = null,
               updated_at = now()
           WHERE user_email = $1`,
          [pendingUser.email, matched.index],
        );
        await logMfaEvent(pendingUser.email, "recovery_used", req.ip, req.headers["user-agent"]);
        challengeOk = true;
      }
    }

    if (!challengeOk) {
      // Increment failure count. If threshold reached, set lockout timestamp.
      const newCount = (row.failed_challenge_count ?? 0) + 1;
      const shouldLock = newCount >= MAX_FAILED_CHALLENGES;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null;

      await query(
        `UPDATE user_mfa
         SET failed_challenge_count = $2,
             locked_until = COALESCE($3::timestamptz, locked_until),
             updated_at = now()
         WHERE user_email = $1`,
        [pendingUser.email, newCount, lockedUntil],
      );
      await logMfaEvent(pendingUser.email, "failure", req.ip, req.headers["user-agent"]);

      if (shouldLock) {
        res.status(429).json({
          ok: false,
          error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
          ts: new Date().toISOString(),
        });
      } else {
        res.status(401).json({ ok: false, error: "Invalid code", ts: new Date().toISOString() });
      }
      return;
    }

    // MFA passed — regenerate session to prevent fixation after full auth.
    const promotedUser = pendingUser;
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.user = promotedUser;

    res.json({
      ok: true,
      data: { email: promotedUser.email, role: promotedUser.role, name: promotedUser.name },
      ts: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Challenge failed", ts: new Date().toISOString() });
  }
});

// POST /api/auth/mfa/enroll/recovery — regenerate recovery codes (requires active MFA)
router.post("/enroll/recovery", requireAuth, async (req, res) => {
  const user = req.session.user!;
  const body = req.body as Record<string, unknown>;
  const token = typeof body["token"] === "string" ? body["token"].trim() : "";

  if (!token) {
    res.status(400).json({ ok: false, error: "Current TOTP token required to regenerate recovery codes", ts: new Date().toISOString() });
    return;
  }

  try {
    const row = await getMfaRow(user.email);
    if (!row?.totp_enabled || !row.totp_secret_encrypted) {
      res.status(400).json({ ok: false, error: "MFA not enabled", ts: new Date().toISOString() });
      return;
    }

    const plainSecret = decryptTotpSecret(row.totp_secret_encrypted);
    if (!verifyTotpToken(plainSecret, token)) {
      res.status(401).json({ ok: false, error: "Invalid code", ts: new Date().toISOString() });
      return;
    }

    const codes = generateRecoveryCodes(10);
    const hashes = codes.map(hashRecoveryCode);

    await query(
      `UPDATE user_mfa
       SET recovery_codes_hashed = $2,
           recovery_codes_used = '{}',
           updated_at = now()
       WHERE user_email = $1`,
      [user.email, hashes],
    );

    await logMfaEvent(user.email, "recovery_reset", req.ip, req.headers["user-agent"]);

    // Never logged — returned once to the frontend.
    res.json({ ok: true, data: { recoveryCodes: codes }, ts: new Date().toISOString() });
  } catch {
    res.status(500).json({ ok: false, error: "Recovery code regeneration failed", ts: new Date().toISOString() });
  }
});

// POST /api/auth/mfa/disable — disable MFA (requires current TOTP challenge)
router.post("/disable", requireAuth, async (req, res) => {
  const user = req.session.user!;
  const body = req.body as Record<string, unknown>;
  const token = typeof body["token"] === "string" ? body["token"].trim() : "";

  if (!token) {
    res.status(400).json({ ok: false, error: "Current TOTP token required to disable MFA", ts: new Date().toISOString() });
    return;
  }

  try {
    const row = await getMfaRow(user.email);
    if (!row?.totp_enabled || !row.totp_secret_encrypted) {
      res.status(400).json({ ok: false, error: "MFA not enabled", ts: new Date().toISOString() });
      return;
    }

    const plainSecret = decryptTotpSecret(row.totp_secret_encrypted);
    if (!verifyTotpToken(plainSecret, token)) {
      res.status(401).json({ ok: false, error: "Invalid code", ts: new Date().toISOString() });
      return;
    }

    await query(
      `UPDATE user_mfa
       SET totp_enabled = false,
           totp_secret_encrypted = null,
           recovery_codes_hashed = null,
           recovery_codes_used = '{}',
           last_totp_step = null,
           enrolled_at = null,
           updated_at = now()
       WHERE user_email = $1`,
      [user.email],
    );

    await logMfaEvent(user.email, "disabled", req.ip, req.headers["user-agent"]);
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    res.status(500).json({ ok: false, error: "Disable MFA failed", ts: new Date().toISOString() });
  }
});

// POST /api/auth/mfa/admin-reset — administrator resets another user's MFA
// Requires admin role. Targeted user must re-enroll. Audit logged.
router.post("/admin-reset", requireAuth, async (req, res) => {
  const admin = req.session.user!;
  if (admin.role !== "admin") {
    res.status(403).json({ ok: false, error: "Forbidden", ts: new Date().toISOString() });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const targetEmail = typeof body["email"] === "string" ? body["email"].trim().toLowerCase() : "";
  if (!targetEmail) {
    res.status(400).json({ ok: false, error: "email required", ts: new Date().toISOString() });
    return;
  }

  try {
    await query(
      `UPDATE user_mfa
       SET totp_enabled = false,
           totp_secret_encrypted = null,
           recovery_codes_hashed = null,
           recovery_codes_used = '{}',
           last_totp_step = null,
           failed_challenge_count = 0,
           locked_until = null,
           enrolled_at = null,
           updated_at = now()
       WHERE user_email = $1`,
      [targetEmail],
    );

    // Audit: record who reset whose MFA.
    await logMfaEvent(
      targetEmail,
      `admin_reset_by:${admin.email}`,
      req.ip,
      req.headers["user-agent"],
    );

    res.json({ ok: true, data: { message: `MFA cleared for ${targetEmail}. User must re-enroll.` }, ts: new Date().toISOString() });
  } catch {
    res.status(500).json({ ok: false, error: "Admin reset failed", ts: new Date().toISOString() });
  }
});

export default router;
