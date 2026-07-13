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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";
import { AIAssistant } from "@/components/ai/AIAssistant";

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

export default function HomePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

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
        <div className="flex items-center gap-3">
          <AIAssistant />
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            data-testid="button-sign-out"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
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
