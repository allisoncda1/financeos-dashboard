import { useState, type FormEvent } from "react";
import { useRouter } from "@/lib/next-compat";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";
import { Loader2, ShieldCheck } from "lucide-react";

export default function MfaChallengePage() {
  const { completeMfaChallenge, logout } = useAuth();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await completeMfaChallenge(recoveryMode ? "" : token, recoveryMode ? token : undefined);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <FinanceOSLogo variant="full" className="mx-auto mb-6 h-20 w-auto" />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ShieldCheck className="mb-3 h-8 w-8 text-emerald-600" />
          <h1 className="text-lg font-semibold text-slate-900">Two-step verification</h1>
          <p className="mt-1 text-sm text-slate-500">
            {recoveryMode ? "Enter one unused recovery code." : "Enter the 6-digit code from your authenticator app."}
          </p>
          {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Input
              aria-label={recoveryMode ? "Recovery code" : "Authentication code"}
              inputMode={recoveryMode ? "text" : "numeric"}
              autoComplete="one-time-code"
              maxLength={recoveryMode ? 64 : 6}
              value={token}
              onChange={(event) => setToken(recoveryMode ? event.target.value : event.target.value.replace(/\D/g, ""))}
              required
              autoFocus
              placeholder={recoveryMode ? "Recovery code" : "000000"}
              className="text-center text-lg tracking-[0.3em]"
            />
            <Button className="w-full" disabled={submitting || (!recoveryMode && token.length !== 6)}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
            </Button>
          </form>
          <button className="mt-4 w-full text-sm text-emerald-700" onClick={() => { setRecoveryMode(!recoveryMode); setToken(""); setError(null); }}>
            {recoveryMode ? "Use authenticator code" : "Use a recovery code"}
          </button>
          <button className="mt-3 w-full text-xs text-slate-500" onClick={cancel}>Cancel and sign out</button>
        </div>
      </div>
    </div>
  );
}
