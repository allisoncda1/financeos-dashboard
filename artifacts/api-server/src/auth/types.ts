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
  | "validation";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  name: string;
};

declare module "express-session" {
  interface SessionData {
    user?: AuthUser;
  }
}
