/**
 * MFA Routes — TOTP enrollment, challenge, recovery code management.
 *
 * Session state during login with MFA:
 *   1. POST /api/auth/login → password OK, MFA enabled → sets session.mfaPending + session.pendingUser, returns 202
 *   2. POST /api/auth/mfa/challenge → TOTP or recovery code verified → sets session.user, clears pending state
 *
 * Security rules enforced here:
 *   - No secret or plaintext recovery code is ever logged
 *   - Generic error messages used throughout (no oracle about what failed)
 *   - Challenge endpoint rate-limited to 5 attempts / 15 minutes
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
import { requireAuth } from "./middleware.js";
import type { AuthUser } from "./types.js";

// ---------------------------------------------------------------------------
// DB pool — shares the Dashboard's operational DATABASE_URL (same DB as sessions)
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
}

async function getMfaRow(email: string): Promise<MfaRow | null> {
  const res = await query<MfaRow>(
    `SELECT totp_secret_encrypted, totp_enabled, recovery_codes_hashed,
            recovery_codes_used, enrolled_at, failed_challenge_count, locked_until
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
router.post("/enroll/totp", requireAuth, async (req, res) => {
  const user = req.session.user!;
  try {
    const enrollment = await generateTotpSecret(user.email);

    // Store the secret as pending (totp_enabled = false until verified).
    // NOTE: In production, encrypt secret with AES-256-GCM before storing.
    // For now we store the base32 value; replace with encrypted form when
    // an encryption key (e.g. TOTP_ENCRYPTION_KEY) is provisioned.
    await query(
      `INSERT INTO user_mfa (user_email, totp_secret_encrypted, totp_enabled)
       VALUES ($1, $2, false)
       ON CONFLICT (user_email) DO UPDATE
         SET totp_secret_encrypted = EXCLUDED.totp_secret_encrypted,
             totp_enabled = false,
             updated_at = now()`,
      [user.email, enrollment.secret],
    );

    await logMfaEvent(user.email, "enroll_started", req.ip, req.headers["user-agent"]);

    // Return secret + QR code. Do NOT log these values.
    res.json({
      ok: true,
      data: {
        secret: enrollment.secret,
        otpauthUrl: enrollment.otpauthUrl,
        qrDataUrl: enrollment.qrDataUrl,
      },
      ts: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Enrollment failed", ts: new Date().toISOString() });
  }
});

// POST /api/auth/mfa/enroll/totp/verify — activate TOTP after scanning QR
router.post("/enroll/totp/verify", requireAuth, async (req, res) => {
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

    const valid = verifyTotpToken(row.totp_secret_encrypted, token);
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
           updated_at = now()
       WHERE user_email = $1`,
      [user.email, hashes],
    );

    await logMfaEvent(user.email, "enrolled", req.ip, req.headers["user-agent"]);

    // Return plaintext codes ONCE — frontend must prompt user to save them.
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

    let challengeOk = false;

    if (token) {
      challengeOk = verifyTotpToken(row.totp_secret_encrypted, token);
      if (challengeOk) {
        await query(
          `UPDATE user_mfa SET last_challenged_at = now(), failed_challenge_count = 0,
           locked_until = null, updated_at = now() WHERE user_email = $1`,
          [pendingUser.email],
        );
        await logMfaEvent(pendingUser.email, "success", req.ip, req.headers["user-agent"]);
      }
    } else if (recoveryCode) {
      const hashes = row.recovery_codes_hashed ?? [];
      const usedIndices = row.recovery_codes_used ?? [];
      // Filter out already-used codes.
      const availableHashes = hashes.filter((_, i) => !usedIndices.includes(i));
      const result = verifyRecoveryCode(recoveryCode, availableHashes);

      if (result.valid) {
        // Find the original index of the matched hash in the full list.
        const originalIndex = hashes.findIndex(
          (h) => h === availableHashes[result.usedIndex],
        );
        await query(
          `UPDATE user_mfa
           SET recovery_codes_used = array_append(recovery_codes_used, $2),
               last_challenged_at = now(),
               failed_challenge_count = 0,
               locked_until = null,
               updated_at = now()
           WHERE user_email = $1`,
          [pendingUser.email, originalIndex],
        );
        await logMfaEvent(pendingUser.email, "recovery_used", req.ip, req.headers["user-agent"]);
        challengeOk = true;
      }
    }

    if (!challengeOk) {
      await query(
        `UPDATE user_mfa
         SET failed_challenge_count = failed_challenge_count + 1, updated_at = now()
         WHERE user_email = $1`,
        [pendingUser.email],
      );
      await logMfaEvent(pendingUser.email, "failure", req.ip, req.headers["user-agent"]);
      res.status(401).json({ ok: false, error: "Invalid code", ts: new Date().toISOString() });
      return;
    }

    // MFA passed — promote pending user to session user.
    req.session.mfaPending = undefined;
    req.session.pendingUser = undefined;
    req.session.user = pendingUser;

    res.json({
      ok: true,
      data: { email: pendingUser.email, role: pendingUser.role, name: pendingUser.name },
      ts: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Challenge failed", ts: new Date().toISOString() });
  }
});

// POST /api/auth/mfa/enroll/recovery — regenerate recovery codes (requires MFA)
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

    if (!verifyTotpToken(row.totp_secret_encrypted, token)) {
      res.status(401).json({ ok: false, error: "Invalid code", ts: new Date().toISOString() });
      return;
    }

    const codes = generateRecoveryCodes(10);
    const hashes = codes.map(hashRecoveryCode);

    await query(
      `UPDATE user_mfa
       SET recovery_codes_hashed = $2, recovery_codes_used = '{}', updated_at = now()
       WHERE user_email = $1`,
      [user.email, hashes],
    );

    await logMfaEvent(user.email, "recovery_reset", req.ip, req.headers["user-agent"]);

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

    if (!verifyTotpToken(row.totp_secret_encrypted, token)) {
      res.status(401).json({ ok: false, error: "Invalid code", ts: new Date().toISOString() });
      return;
    }

    await query(
      `UPDATE user_mfa
       SET totp_enabled = false, totp_secret_encrypted = null,
           recovery_codes_hashed = null, recovery_codes_used = '{}',
           enrolled_at = null, updated_at = now()
       WHERE user_email = $1`,
      [user.email],
    );

    await logMfaEvent(user.email, "disabled", req.ip, req.headers["user-agent"]);

    res.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    res.status(500).json({ ok: false, error: "Disable MFA failed", ts: new Date().toISOString() });
  }
});

export default router;
