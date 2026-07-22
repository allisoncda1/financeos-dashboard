import { Router, type IRouter } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { validateCredentials } from "../auth/service";
import { ROLE_PERMISSIONS } from "../auth/permissions";

const router: IRouter = Router();

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
