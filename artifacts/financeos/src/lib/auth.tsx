import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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

export type AuthedUser = {
  email: string;
  role: Role;
  name: string;
  permissions: Permission[];
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type LoginResult =
  | { next: "authenticated" }
  | { next: "mfa_challenge" }
  | { next: "mfa_enrollment" };

type AuthContextValue = {
  user: AuthedUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeMfaChallenge: (token: string, recoveryCode?: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = "/api/auth";

/**
 * Broadcasts a 401 seen anywhere in the app (see lib/api.ts) so the
 * AuthProvider can immediately clear stale user state and redirect to
 * /login without every call site needing to know about auth.
 */
export const SESSION_EXPIRED_EVENT = "financeos:session-expired";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/me`, { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      const json = await res.json();
      if (!json.ok) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      setUser(json.data as AuthedUser);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      setStatus("unauthenticated");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await fetch(`${BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => ({ ok: false, error: `Login failed (${res.status})` }));
    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? "Invalid email or password");
    }
    if (json.mfaEnrollmentRequired) return { next: "mfa_enrollment" };
    if (json.mfaRequired) return { next: "mfa_challenge" };
    await refresh();
    return { next: "authenticated" };
  }, [refresh]);

  const completeMfaChallenge = useCallback(async (token: string, recoveryCode?: string) => {
    const res = await fetch(`${BASE}/mfa/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(recoveryCode ? { recoveryCode } : { token }),
    });
    const json = await res.json().catch(() => ({ ok: false, error: `Verification failed (${res.status})` }));
    if (!res.ok || !json.ok) throw new Error(json.error ?? "Verification failed");
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch(`${BASE}/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => Boolean(user?.permissions.includes(permission)),
    [user],
  );

  const value = useMemo(
    () => ({ user, status, login, completeMfaChallenge, refresh, logout, hasPermission }),
    [user, status, login, completeMfaChallenge, refresh, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
