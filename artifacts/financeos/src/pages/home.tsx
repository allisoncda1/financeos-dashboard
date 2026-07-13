import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/lib/next-compat";
import {
  BarChart3,
  Wallet,
  TrendingUp,
  Banknote,
  BookOpen,
  LineChart,
  LogOut,
  ArrowRight,
  ArrowUp,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";

type ModuleCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  titleColor: string;
  active?: boolean;
  href?: string;
  cta?: string;
  buttonClasses?: string;
};

const MODULES: ModuleCard[] = [
  {
    title: "Reporting",
    description: "Financial reports and performance insights",
    icon: BarChart3,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    titleColor: "text-blue-700",
    active: true,
    href: "/",
    cta: "Open Dashboard",
    buttonClasses: "bg-blue-600 hover:bg-blue-700",
  },
  {
    title: "Budget",
    description: "Plan, track and analyze your budgets",
    icon: Wallet,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    titleColor: "text-emerald-600",
    active: true,
    href: "/budget",
    cta: "Open Budget",
    buttonClasses: "bg-emerald-600 hover:bg-emerald-700",
  },
  {
    title: "Forecast",
    description: "Predict future performance and cash flow",
    icon: TrendingUp,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    titleColor: "text-purple-600",
    active: true,
    href: "/forecast",
    cta: "Open Forecast",
    buttonClasses: "bg-purple-600 hover:bg-purple-700",
  },
  {
    title: "Commission",
    description: "Track commissions and payouts",
    icon: Banknote,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    titleColor: "text-orange-500",
    active: true,
    href: "/commissions",
    cta: "Open Commissions",
    buttonClasses: "bg-orange-500 hover:bg-orange-600",
  },
  {
    title: "Accounting",
    description: "Manage accounting and reconciliations",
    icon: BookOpen,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    titleColor: "text-blue-700",
    active: true,
    href: "/accounting",
    cta: "Open Workspace",
    buttonClasses: "bg-blue-600 hover:bg-blue-700",
  },
  {
    title: "Analytics",
    description: "Advanced financial analysis, trends and business insights.",
    icon: LineChart,
    iconBg: "bg-gradient-to-br from-blue-50 to-purple-50",
    iconColor: "text-indigo-600",
    titleColor: "text-indigo-600",
    active: true,
    href: "/analyze/performance",
    cta: "Open Analytics",
    buttonClasses:
      "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
  },
];

const PROMPT_SUGGESTIONS = [
  "Why did profit decrease this month?",
  "Forecast next quarter",
  "Show overdue invoices",
  "Explain this cash flow",
  "Compare this month vs last month",
];

export default function HomePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const handleSignOut = async () => {
    await logout();
    router.replace("/login");
  };

  const openModule = (href: string) => {
    router.push(href);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA]">
      <header className="flex items-center justify-between px-6 sm:px-10 py-5">
        <FinanceOSLogo variant="full" className="h-11 w-auto" />
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          data-testid="button-sign-out"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-10">
        <div className="text-center mt-8 sm:mt-14 mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            Welcome back, {firstName}{" "}
            <span role="img" aria-label="wave">
              👋
            </span>
          </h1>
          <p className="mt-4 text-[15px] sm:text-lg text-gray-500">
            All your finance. One platform.{" "}
            <span className="text-emerald-500 font-medium">Total clarity.</span>
          </p>
        </div>

        <section
          className="mb-12 w-full max-w-5xl rounded-[20px] border border-white/60 bg-gradient-to-br from-white/90 via-blue-50/60 to-purple-50/50 p-6 shadow-[0_8px_30px_rgba(59,80,160,0.08)] backdrop-blur-sm sm:p-8"
          data-testid="section-ai-companion"
        >
          <div className="flex flex-col items-center gap-6 sm:gap-8 md:flex-row">
            <div className="flex shrink-0 flex-col items-center">
              <div className="relative">
                <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-blue-200/50 to-purple-200/40 blur-2xl" />
                <img
                  src="/branding/finos-mascot.png"
                  alt="FinanceOS AI companion"
                  className="h-32 w-32 object-contain drop-shadow-md transition-transform duration-300 hover:scale-105 sm:h-40 sm:w-40"
                  data-testid="img-ai-mascot"
                />
              </div>
              <span className="mt-2 flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-indigo-600 shadow-sm">
                <Sparkles className="h-3 w-3" />
                Your CFO copilot
              </span>
            </div>

            <div className="w-full min-w-0 flex-1">
              <div className="group flex items-center gap-3 rounded-[18px] border border-gray-200/70 bg-white/90 px-5 py-4 shadow-[0_2px_12px_rgba(16,24,40,0.06)] transition-shadow duration-300 focus-within:shadow-[0_4px_20px_rgba(99,102,241,0.15)] hover:shadow-[0_4px_16px_rgba(16,24,40,0.09)]">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask me anything about your business..."
                  className="w-full bg-transparent text-[15px] text-gray-800 placeholder:text-gray-400 focus:outline-none"
                  data-testid="input-ai-prompt"
                />
                <button
                  type="button"
                  aria-label="Send"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm transition-transform duration-200 hover:scale-105"
                  data-testid="button-ai-send"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {PROMPT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPrompt(s)}
                    className="rounded-full border border-gray-200/80 bg-white/70 px-3.5 py-1.5 text-[12px] font-medium text-gray-600 shadow-sm transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50/70 hover:text-indigo-600"
                    data-testid={`chip-suggestion-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.title}
                onClick={mod.active && mod.href ? () => openModule(mod.href!) : undefined}
                className={`relative flex flex-col items-center rounded-2xl border border-gray-200/80 bg-white px-8 py-10 text-center shadow-[0_1px_3px_rgba(16,24,40,0.06)] ${
                  mod.active
                    ? "cursor-pointer transition-shadow hover:shadow-[0_4px_12px_rgba(16,24,40,0.1)]"
                    : "select-none"
                }`}
                data-testid={`card-module-${mod.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {!mod.active && (
                  <span className="absolute right-4 top-4 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Coming soon
                  </span>
                )}

                <div
                  className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full ${mod.iconBg}`}
                >
                  <Icon className={`h-7 w-7 ${mod.iconColor}`} />
                </div>

                <h2 className={`text-[17px] font-bold ${mod.titleColor}`}>{mod.title}</h2>
                <p className="mt-2 max-w-[220px] text-[13px] leading-relaxed text-gray-500">
                  {mod.description}
                </p>

                {mod.active && mod.href && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openModule(mod.href!);
                    }}
                    className={`mt-6 flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors ${mod.buttonClasses ?? "bg-blue-600 hover:bg-blue-700"}`}
                    data-testid={`button-open-${mod.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {mod.cta}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <footer className="pb-8 text-center text-[13px] text-gray-500">
        Built for finance. Powered by{" "}
        <span className="text-blue-600 font-medium">intelligence.</span>
      </footer>
    </div>
  );
}
