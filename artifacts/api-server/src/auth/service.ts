import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { AuthUser, Role } from "./types";

/**
 * Auth service — deliberately isolated behind validateCredentials() /
 * createSessionUser() so this can later be swapped for a real user store
 * (Postgres table, Auth0, Clerk, Supabase Auth, etc.) without touching
 * routes, middleware, or the frontend.
 */

type ConfiguredUser = {
  email: string;
  password: string;
  role: Role;
  name: string;
};

const VALID_ROLES: Role[] = ["admin", "cfo", "controller", "bookkeeper", "investor", "readonly"];

function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (VALID_ROLES as string[]).includes(value);
}

function parseConfiguredUsers(): ConfiguredUser[] {
  const raw = process.env["FINANCEOS_USERS"];
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const users: ConfiguredUser[] = [];
    for (const entry of parsed) {
      if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as Record<string, unknown>)["email"] === "string" &&
        typeof (entry as Record<string, unknown>)["password"] === "string" &&
        isValidRole((entry as Record<string, unknown>)["role"]) &&
        typeof (entry as Record<string, unknown>)["name"] === "string"
      ) {
        const e = entry as Record<string, unknown>;
        users.push({
          email: e["email"] as string,
          password: e["password"] as string,
          role: e["role"] as Role,
          name: e["name"] as string,
        });
      }
    }
    return users;
  } catch {
    // Malformed FINANCEOS_USERS is treated as no additional users, never crashes startup.
    return [];
  }
}

function getConfiguredAdmin(): ConfiguredUser | null {
  const email = process.env["FINANCEOS_ADMIN_EMAIL"];
  const password = process.env["FINANCEOS_ADMIN_PASSWORD"];
  if (!email || !password) return null;
  return { email, password, role: "admin", name: "Allison" };
}

function findConfiguredUser(email: string): ConfiguredUser | null {
  const normalized = email.trim().toLowerCase();

  const admin = getConfiguredAdmin();
  if (admin && admin.email.trim().toLowerCase() === normalized) return admin;

  for (const user of parseConfiguredUsers()) {
    if (user.email.trim().toLowerCase() === normalized) return user;
  }

  return null;
}

async function passwordMatches(submitted: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$") || stored.startsWith("$2y$")) {
    return bcrypt.compare(submitted, stored);
  }
  // Plain-text comparison — supported only for initial setup simplicity.
  // Operators are expected to move to bcrypt hashes for production use.
  return submitted === stored;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function validateCredentials(email: string, password: string): Promise<AuthUser | null> {
  const configured = findConfiguredUser(email);

  if (!configured) {
    await delay(200);
    return null;
  }

  const matches = await passwordMatches(password, configured.password);

  if (!matches) {
    await delay(200);
    return null;
  }

  return createSessionUser(configured.email, configured.role, configured.name);
}

export function createSessionUser(email: string, role: Role, name: string): AuthUser {
  return {
    id: randomUUID(),
    email,
    role,
    name,
  };
}
