import { Router, type IRouter } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { validateCredentials } from "../auth/service";
import { ROLE_PERMISSIONS } from "../auth/permissions";
import {
  createResetToken,
  validateResetToken,
  resetPassword,
} from "../auth/passwordResetService";
import { sendEmail, emailConfigured } from "../lib/email";

const router: IRouter = Router();

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  handler: (_req, res) => {
    res.status(429).json({
      ok: false,
      error: "Too many password reset requests. Please try again later.",
      ts: new Date().toISOString(),
    });
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  handler: (_req, res) => {
    res.status(429).json({
      ok: false,
      error: "Too many login attempts. Please try again later.",
      ts: new Date().toISOString(),
    });
  },
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  const email = typeof body?.["email"] === "string" ? body["email"] : "";
  const password = typeof body?.["password"] === "string" ? body["password"] : "";

  if (!email || !password) {
    res.status(401).json({
      ok: false,
      error: "Invalid email or password",
      ts: new Date().toISOString(),
    });
    return;
  }

  const user = await validateCredentials(email, password);

  if (!user) {
    res.status(401).json({
      ok: false,
      error: "Invalid email or password",
      ts: new Date().toISOString(),
    });
    return;
  }

  // Session fixation fix: regenerate the session ID after a successful credential
  // check so the pre-login session token cannot be reused post-login.
  // CSRF protection note: this app relies on sameSite:lax + httpOnly cookies for
  // CSRF protection, which is adequate for same-origin form posts without external
  // embeds. No separate CSRF token is required under this configuration.
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

  // Check if MFA is enabled for this user. If so, set mfaPending state and
  // return 202 so the frontend can prompt for the TOTP/recovery code.
  const { getUserMfaStatus } = await import("../auth/mfaRoutes.js");
  const mfaStatus = await getUserMfaStatus(user.email).catch(() => null);

  if (mfaStatus?.totpEnabled) {
    req.session.mfaPending = true;
    req.session.pendingUser = user;
    res.status(202).json({
      ok: true,
      mfaRequired: true,
      mfaEnrollmentRequired: false,
      ts: new Date().toISOString(),
    });
    return;
  }

  // MFA is mandatory. Keep a narrowly scoped enrollment session so the user
  // can obtain and verify a TOTP secret, but block every normal protected route.
  req.session.user = user;
  req.session.mfaEnrollmentRequired = true;

  res.status(202).json({
    ok: true,
    mfaRequired: false,
    mfaEnrollmentRequired: true,
    ts: new Date().toISOString(),
  });
});

// POST /api/auth/forgot-password — request a reset link.
// Always responds 200 with the same body whether or not the email exists,
// to prevent account enumeration.
router.post("/forgot-password", forgotLimiter, async (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  const email = typeof body?.["email"] === "string" ? body["email"].trim().toLowerCase() : "";

  const genericResponse = {
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
    ts: new Date().toISOString(),
  };

  if (!email || !emailConfigured()) {
    if (!emailConfigured()) req.log.error("forgot-password: email service not configured");
    res.json(genericResponse);
    return;
  }

  try {
    const rawToken = await createResetToken(email);
    if (rawToken) {
      const baseUrl = process.env["APP_PUBLIC_URL"] ?? `${req.protocol}://${req.get("host")}`;
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
      await sendEmail({
        to: email,
        subject: "Reset your FinanceOS password",
        text:
          `A password reset was requested for your FinanceOS account.\n\n` +
          `Reset your password: ${resetUrl}\n\n` +
          `This link expires in 1 hour and can be used once. ` +
          `If you didn't request this, you can safely ignore this email.`,
        html:
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">` +
          `<h2 style="color:#111">Reset your FinanceOS password</h2>` +
          `<p style="color:#444">A password reset was requested for your FinanceOS account.</p>` +
          `<p><a href="${resetUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Reset password</a></p>` +
          `<p style="color:#888;font-size:13px">This link expires in 1 hour and can be used once. If you didn't request this, you can safely ignore this email.</p>` +
          `</div>`,
      });
    }
  } catch (err) {
    // Log the failure (no token/email content beyond the address) but never
    // reveal it to the caller — response stays generic.
    req.log.error({ err }, "forgot-password: failed to create/send reset email");
  }

  res.json(genericResponse);
});

// GET /api/auth/reset-password/validate?token=… — check a link before showing the form.
router.get("/reset-password/validate", async (req, res) => {
  const token = typeof req.query["token"] === "string" ? req.query["token"] : "";
  if (!token) {
    res.status(400).json({ ok: false, error: "token is required", ts: new Date().toISOString() });
    return;
  }
  try {
    const status = await validateResetToken(token);
    if (!status.valid) {
      const msg =
        status.reason === "expired"
          ? "This reset link has expired. Please request a new one."
          : "This reset link is invalid or has already been used.";
      res.status(410).json({ ok: false, error: msg, ts: new Date().toISOString() });
      return;
    }
    // Deliberately does NOT return the account email — a bearer of the token
    // link should not learn which account it targets.
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "reset-password validate failed");
    res.status(503).json({ ok: false, error: "Service unavailable", ts: new Date().toISOString() });
  }
});

// POST /api/auth/reset-password — consume the token and set the new password.
router.post("/reset-password", forgotLimiter, async (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  const token = typeof body?.["token"] === "string" ? body["token"] : "";
  const password = typeof body?.["password"] === "string" ? body["password"] : "";

  if (!token) {
    res.status(400).json({ ok: false, error: "token is required", ts: new Date().toISOString() });
    return;
  }
  if (password.length < 12) {
    res.status(400).json({
      ok: false,
      error: "Password must be at least 12 characters",
      ts: new Date().toISOString(),
    });
    return;
  }

  try {
    const { email } = await resetPassword(token, password);
    req.log.info({ email }, "password reset completed");
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reset failed";
    res.status(400).json({ ok: false, error: msg, ts: new Date().toISOString() });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Failed to destroy session");
    }
    res.clearCookie("connect.sid");
    res.json({ ok: true, ts: new Date().toISOString() });
  });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  const user = req.session.user;

  if (!user || req.session.mfaEnrollmentRequired || req.session.mfaPending) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized",
      code: req.session.mfaEnrollmentRequired
        ? "MFA_ENROLLMENT_REQUIRED"
        : req.session.mfaPending
          ? "MFA_REQUIRED"
          : "NOT_AUTHENTICATED",
      ts: new Date().toISOString(),
    });
    return;
  }

  res.json({
    ok: true,
    data: {
      email: user.email,
      role: user.role,
      name: user.name,
      permissions: ROLE_PERMISSIONS[user.role],
    },
    ts: new Date().toISOString(),
  });
});

export default router;
