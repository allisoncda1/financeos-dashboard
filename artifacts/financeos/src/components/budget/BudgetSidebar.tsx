import { usePathname } from "@/lib/next-compat";
import Link from "@/lib/next-compat";
import {
  LayoutDashboard,
  Calculator,
  BarChart3,
  Network,
  History,
  Lightbulb,
  FileText,
  Settings,
  HelpCircle
} from "lucide-react";
import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/budget" },
  { label: "Budget Builder", icon: Calculator, href: "/budget/builder" },
  { label: "Budget vs Actual", icon: BarChart3, href: "/budget/budget-vs-actual" },
  { label: "Department Budgets", icon: Network, href: "/budget/departments" },
  { label: "Budget Versions", icon: History, href: "/budget/versions" },
  { label: "Assumptions", icon: Lightbulb, href: "/budget/assumptions" },
  { label: "Reports", icon: FileText, href: "/budget/reports" },
  { label: "Settings", icon: Settings, href: "/budget/settings" },
];

export function BudgetSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-full shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-200 shrink-0">
        <Link href="/home" className="flex items-center hover:opacity-80 transition-opacity">
          <FinanceOSLogo variant="full" className="h-7 w-auto" />
        </Link>
      </div>

      <div className="px-6 py-5 shrink-0">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Budget Module
        </h2>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/budget"
                ? pathname === "/budget" ||
                  ["/budget/pnl", "/budget/cash-flow", "/budget/balance-sheet"].includes(pathname)
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 shrink-0">
        <a
          href="#"
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          Need help? View Budget Guide
        </a>
      </div>
    </aside>
  );
}
