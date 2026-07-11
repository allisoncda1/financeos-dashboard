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
    <div className="flex items-center gap-1 flex-shrink-0 pt-2 pb-0">
      {TAB_ITEMS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-testid={tab.testId}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors -mb-px ${
              isActive
                ? "border-emerald-500 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
