import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "@/lib/next-compat";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";

function useQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function LoginPage() {
  const { user, status, login } = useAuth();
  const router = useRouter();
  const reason = useQueryParam("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace("/home");
    }
  }, [status, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.next === "mfa_enrollment") router.replace("/mfa/setup");
      else if (result.next === "mfa_challenge") router.replace("/mfa/challenge");
      else router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
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
          <h1 className="text-[16px] font-semibold text-gray-900 mb-1">Sign in</h1>
          <p className="text-[12px] text-gray-500 mb-5">Use your FinanceOS credentials to continue.</p>

          {reason === "session_expired" && !error && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
              Your session expired. Please sign in again.
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full mt-2" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
