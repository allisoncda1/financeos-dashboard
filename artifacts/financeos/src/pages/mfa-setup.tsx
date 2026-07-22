import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "@/lib/next-compat";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";
import { Check, Copy, Loader2, ShieldCheck } from "lucide-react";

type Enrollment = { secret: string; otpauthUrl: string; qrDataUrl: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/auth/mfa${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await response.json().catch(() => ({ ok: false, error: `Request failed (${response.status})` }));
  if (!response.ok || !json.ok) throw new Error(json.error ?? "Request failed");
  return json.data as T;
}

export default function MfaSetupPage() {
  const { refresh, logout } = useAuth();
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [token, setToken] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void api<Enrollment>("/enroll/totp", { method: "POST" })
      .then((data) => { if (active) setEnrollment(data); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Enrollment failed"); });
    return () => { active = false; };
  }, []);

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api<{ recoveryCodes: string[] }>("/enroll/totp/verify", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setRecoveryCodes(data.recoveryCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setSubmitting(false);
    }
  };

  const finish = async () => {
    await refresh();
    router.replace("/home");
  };

  const cancel = async () => {
    await logout();
    router.replace("/login");
  };

  if (recoveryCodes) {
    return (
      <SetupShell>
        <ShieldCheck className="mb-3 h-8 w-8 text-emerald-600" />
        <h1 className="text-lg font-semibold">Save your recovery codes</h1>
        <p className="mt-1 text-sm text-slate-500">These codes are shown once. Keep them somewhere secure.</p>
        <div className="my-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-4 font-mono text-xs">
          {recoveryCodes.map((code) => <span key={code}>{code}</span>)}
        </div>
        <Button variant="outline" className="w-full" onClick={async () => { await navigator.clipboard.writeText(recoveryCodes.join("\n")); setCopied(true); }}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copied" : "Copy codes"}
        </Button>
        <Button className="mt-3 w-full" onClick={finish}>I saved these codes</Button>
      </SetupShell>
    );
  }

  return (
    <SetupShell>
      <ShieldCheck className="mb-3 h-8 w-8 text-emerald-600" />
      <h1 className="text-lg font-semibold text-slate-900">Protect your FinanceOS account</h1>
      <p className="mt-1 text-sm text-slate-500">Scan this QR code with Google Authenticator, Microsoft Authenticator, 1Password, or another authenticator app.</p>
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {!enrollment && !error && <Loader2 className="mx-auto my-10 h-7 w-7 animate-spin text-emerald-600" />}
      {enrollment && (
        <>
          <img src={enrollment.qrDataUrl} alt="FinanceOS MFA QR code" className="mx-auto my-5 h-52 w-52 rounded-xl border bg-white p-2" />
          <details className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">Can’t scan? Use the setup key</summary>
            <code className="mt-2 block break-all select-all">{enrollment.secret}</code>
          </details>
          <form onSubmit={verify} className="mt-5 space-y-3">
            <label className="block text-xs font-medium text-slate-600" htmlFor="mfa-token">Enter the 6-digit code</label>
            <Input id="mfa-token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="text-center text-lg tracking-[0.3em]" required />
            <Button className="w-full" disabled={submitting || token.length !== 6}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify and enable MFA"}</Button>
          </form>
        </>
      )}
      <button className="mt-4 w-full text-xs text-slate-500" onClick={cancel}>Cancel and sign out</button>
    </SetupShell>
  );
}

function SetupShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md">
        <FinanceOSLogo variant="full" className="mx-auto mb-6 h-20 w-auto" />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
