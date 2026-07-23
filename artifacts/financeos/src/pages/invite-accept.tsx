/**
 * InviteAcceptPage — public page at /invite/accept?token=<rawToken>
 *
 * Flow:
 *  1. Load — validate the token via GET /api/invitations/:token
 *  2. Show a form to set a password
 *  3. Submit — POST /api/invitations/:token/accept
 *  4. On success — redirect to /login with a note to complete MFA enrollment
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

type InviteInfo = {
  email: string;
  display_name: string;
  role: string;
  expires_at: string;
};

function getTokenFromSearch(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? "";
}

export default function InviteAcceptPage() {
  const [, navigate] = useLocation();
  const rawToken = getTokenFromSearch();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!rawToken) {
      setLoadError("No invitation token found in the URL.");
      setLoading(false);
      return;
    }

    fetch(`/api/invitations/${encodeURIComponent(rawToken)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Invalid or expired invitation");
        setInviteInfo(json.data as InviteInfo);
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [rawToken]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 12) {
      setSubmitError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(rawToken)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-[13px] text-gray-500">Validating invitation…</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 max-w-sm w-full px-8 py-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <h1 className="text-[16px] font-semibold text-gray-900">Account created</h1>
          <p className="text-[12px] text-gray-600 leading-relaxed">
            Your FinanceOS account is ready. Log in and complete MFA enrollment to activate access.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full mt-2 px-4 py-2.5 bg-blue-600 text-white text-[13px] font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 max-w-sm w-full px-8 py-10 text-center space-y-3">
          <h1 className="text-[15px] font-semibold text-gray-900">Invitation unavailable</h1>
          <p className="text-[12px] text-red-600">{loadError}</p>
          <p className="text-[11px] text-gray-500">
            This link may have expired or already been used. Contact your administrator for a new invitation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 max-w-sm w-full px-8 py-10 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-[16px] font-semibold text-gray-900">Set up your account</h1>
          {inviteInfo && (
            <p className="text-[12px] text-gray-500">
              You've been invited as <strong>{inviteInfo.display_name}</strong> ({inviteInfo.role})
            </p>
          )}
          {inviteInfo && (
            <p className="text-[11px] font-medium text-gray-700">{inviteInfo.email}</p>
          )}
        </div>

        <form onSubmit={(e) => { void submit(e); }} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Password <span className="font-normal text-gray-400">(min 12 characters)</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-9 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Create a strong password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Confirm password</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Repeat your password"
            />
          </div>

          {submitError && (
            <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2.5 bg-blue-600 text-white text-[13px] font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-[10px] text-center text-gray-400 leading-relaxed">
          After creating your account you must log in and complete multi-factor authentication setup before accessing FinanceOS.
        </p>
      </div>
    </div>
  );
}
