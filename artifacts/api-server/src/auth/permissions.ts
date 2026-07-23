import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Permission, Role } from "./types";

const ALL_PERMISSIONS: Permission[] = [
  "dashboard",
  "entity_pages",
  "financials",
  "customers",
  "vendors",
  "banking",
  "operations",
  "analyze",
  "reports",
  "exports",
  "ai",
  "control",
  "settings",
  "pipeline_refresh",
  "validation",
  "user-management",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL_PERMISSIONS,
  cfo: [
    "dashboard",
    "entity_pages",
    "financials",
    "customers",
    "vendors",
    "banking",
    "operations",
    "analyze",
    "reports",
    "exports",
    "ai",
  ],
  controller: [
    "dashboard",
    "entity_pages",
    "financials",
    "operations",
    "reports",
    "validation",
    "control",
    "user-management",
  ],
  bookkeeper: ["entity_pages", "customers", "vendors", "operations"],
  investor: ["dashboard", "reports", "exports"],
  readonly: ["dashboard"],
};

export function hasPermission(user: { role: Role }, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
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

    if (!hasPermission(user, permission)) {
      res.status(403).json({
        ok: false,
        error: "You don't have permission to perform this action.",
        code: "FORBIDDEN",
        ts: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
