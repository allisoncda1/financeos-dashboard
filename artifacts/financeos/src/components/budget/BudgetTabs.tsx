import Link, { usePathname } from "@/lib/next-compat";

const TAB_ITEMS = [
  { label: "Summary", href: "/budget", testId: "tab-budget-summary" },
  { label: "P&L", href: "/budget/pnl", testId: "tab-budget-pnl" },
  { label: "Cash Flow", href: "/budget/cash-flow", testId: "tab-budget-cash-flow" },
  { label: "Balance Sheet", href: "/budget/balance-sheet", testId: "tab-budget-balance-sheet" },
];

export function BudgetTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 w-full flex justify-start space-x-6">
      {TAB_ITEMS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-testid={tab.testId}
            className={`border-b-2 font-medium pb-2 px-0 text-sm transition-colors ${
              isActive
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
