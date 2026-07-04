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

  req.session.user = user;

  res.json({
    ok: true,
    data: { email: user.email, role: user.role, name: user.name },
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

  if (!user) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized",
      code: "NOT_AUTHENTICATED",
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
