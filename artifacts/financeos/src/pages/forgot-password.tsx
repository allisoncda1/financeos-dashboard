import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Something went wrong. Please try again.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
          <h1 className="text-[16px] font-semibold text-gray-900 mb-1">Forgot password</h1>
          <p className="text-[12px] text-gray-500 mb-5">
            Enter your email and we'll send you a reset link.
          </p>

          {sent ? (
            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-[12px] text-green-800">
              If an account exists for that email, a reset link has been sent. Check your inbox —
              the link expires in 1 hour.
            </div>
          ) : (
            <>
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
                <Button type="submit" className="w-full mt-2" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-4 text-center text-[12px] text-gray-500">
            <Link href="/login" className="text-gray-700 underline underline-offset-2">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
