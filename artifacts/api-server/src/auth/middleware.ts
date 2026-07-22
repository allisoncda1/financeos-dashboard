import type { Request, Response, NextFunction } from "express";

/**
 * requireAuth — blocks unauthenticated access to protected /api/* routes.
 * Page-level redirects are handled by the frontend (ProtectedRoute), which
 * reacts to a 401 from GET /api/auth/me or any other API call.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Reject if no user, OR if the user has passed password but MFA is still pending.
  if (!req.session.user || req.session.mfaPending) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized",
      code: req.session.mfaPending ? "MFA_REQUIRED" : "NOT_AUTHENTICATED",
      ts: new Date().toISOString(),
    });
    return;
  }

  next();
}

/**
 * requireMfa — identical to requireAuth but explicitly requires that the full
 * MFA flow is complete (session.user set AND no mfaPending flag).
 * Use on endpoints that explicitly need MFA-verified identity.
 */
export function requireMfa(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user || req.session.mfaPending) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized",
      code: req.session.mfaPending ? "MFA_REQUIRED" : "NOT_AUTHENTICATED",
      ts: new Date().toISOString(),
    });
    return;
  }
  next();
}

/**
 * optionalAuth — attaches the session user to the request when present but
 * never blocks the request. Useful for routes that behave differently for
 * signed-in users without requiring auth outright.
 */
export function optionalAuth(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
