import type { Request, Response, NextFunction } from "express";

/**
 * requireAuth — blocks unauthenticated access to protected /api/* routes.
 * Page-level redirects are handled by the frontend (ProtectedRoute), which
 * reacts to a 401 from GET /api/auth/me or any other API call.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized",
      code: "NOT_AUTHENTICATED",
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
