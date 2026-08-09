import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

type LinkState = "checking" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [token] = useState(getToken);
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [linkError, setLinkError] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLinkState("invalid");
      setLinkError("This reset link is invalid — no token found.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
          { credentials: "include" },
        );
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; data?: { email?: string } }
          | null;
        if (cancelled) return;
        if (res.ok && body?.ok) {
          setEmail(body.data?.email ?? "");
          setLinkState("valid");
        } else {
          setLinkState("invalid");
          setLinkError(body?.error ?? "This reset link is invalid or has expired.");
        }
      } catch {
        if (!cancelled) {
          setLinkState("invalid");
          setLinkError("Could not verify the reset link. Please try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error ?? "Reset failed. Please try again.");
      }
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex h-screen w-full items-center justify-center bg-center bg-cover bg-no-repeat"
      style={{ backgroundImage: "url('/branding/login-bg.jpg')", backgroundColor: "#ffffff" }}
    >
      <div className="w-full max-w-sm px-6">
        <div className="flex flex-col items-center mb-6">
          <FinanceOSLogo variant="full" className="h-24 w-auto" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-[16px] font-semibold text-gray-900 mb-1">Reset password</h1>

          {linkState === "checking" && (
            <div className="flex items-center gap-2 text-[12px] text-gray-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying reset link…
            </div>
          )}

          {linkState === "invalid" && (
            <>
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
                {linkError}
              </div>
              <p className="mt-4 text-center text-[12px] text-gray-500">
                <Link href="/forgot-password" className="text-gray-700 underline underline-offset-2">
                  Request a new link
                </Link>
              </p>
            </>
          )}

          {linkState === "valid" && done && (
            <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-[12px] text-green-800">
              Password updated. Redirecting you to sign in…
            </div>
          )}

          {linkState === "valid" && !done && (
            <>
              <p className="text-[12px] text-gray-500 mb-5">
                Set a new password{email ? ` for ${email}` : ""}. Minimum 12 characters.
              </p>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1" htmlFor="password">
                    New password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1" htmlFor="confirm">
                    Confirm password
                  </label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••••••"
                  />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set new password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
