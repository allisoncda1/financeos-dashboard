import type { Request, Response, NextFunction } from "express";

/**
 * requireAuth — blocks unauthenticated access to protected /api/* routes.
 * Page-level redirects are handled by the frontend (ProtectedRoute), which
 * reacts to a 401 from GET /api/auth/me or any other API call.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Reject partial sessions: neither a pending challenge nor a pending first-time
  // enrollment is sufficient to access FinanceOS financial data.
  if (!req.session.user || req.session.mfaPending || req.session.mfaEnrollmentRequired) {
    const code = req.session.mfaPending
      ? "MFA_REQUIRED"
      : req.session.mfaEnrollmentRequired
        ? "MFA_ENROLLMENT_REQUIRED"
        : "NOT_AUTHENTICATED";
    res.status(401).json({
      ok: false,
      error: "Unauthorized",
      code,
      ts: new Date().toISOString(),
    });
    return;
  }

  next();
}

/**
 * Allows only the narrow first-time enrollment session. It cannot be used for
 * normal application routes and therefore does not weaken requireAuth.
 */
export function requireMfaEnrollment(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user || !req.session.mfaEnrollmentRequired || req.session.mfaPending) {
    res.status(401).json({
      ok: false,
      error: "MFA enrollment session required",
      code: "MFA_ENROLLMENT_SESSION_REQUIRED",
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
  if (!req.session.user || req.session.mfaPending || req.session.mfaEnrollmentRequired) {
    const code = req.session.mfaPending
      ? "MFA_REQUIRED"
      : req.session.mfaEnrollmentRequired
        ? "MFA_ENROLLMENT_REQUIRED"
        : "NOT_AUTHENTICATED";
    res.status(401).json({
      ok: false,
      error: "Unauthorized",
      code,
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
