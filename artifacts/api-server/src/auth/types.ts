/**
 * Auth types — deliberately minimal so the auth layer can be swapped later
 * (Google OAuth, Auth0, Clerk, Supabase Auth, multi-user DB) without
 * touching route handlers or the frontend AuthContext contract.
 */

export type Role = "admin" | "cfo" | "controller" | "bookkeeper" | "investor" | "readonly";

export type Permission =
  | "dashboard"
  | "entity_pages"
  | "financials"
  | "customers"
  | "vendors"
  | "banking"
  | "operations"
  | "analyze"
  | "reports"
  | "exports"
  | "ai"
  | "control"
  | "settings"
  | "pipeline_refresh"
  | "validation"
  | "user-management";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  name: string;
  mfaEnabled?: boolean;
  mfaPending?: boolean;
  /** Set for DB-resident invited users only; indicates whether MFA enrollment is already done. */
  _mfaComplete?: boolean;
};

declare module "express-session" {
  interface SessionData {
    user?: AuthUser;
    /** Set after password success when MFA is required; cleared after TOTP/recovery challenge. */
    mfaPending?: boolean;
    /** Holds the authenticated user identity while MFA challenge is pending. */
    pendingUser?: AuthUser;
    /** Password is valid, but first-time TOTP enrollment must finish before app access. */
    mfaEnrollmentRequired?: boolean;
  }
}
