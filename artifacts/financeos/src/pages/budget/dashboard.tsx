import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { BudgetKpiCard } from "@/components/budget/BudgetKpiCard";
import { BudgetVsPriorYearChart } from "@/components/budget/BudgetVsPriorYearChart";
import { BudgetCategoryChart } from "@/components/budget/BudgetCategoryChart";
import { BudgetTable } from "@/components/budget/BudgetTable";
import { BudgetSummaryCard } from "@/components/budget/BudgetSummaryCard";
import { RecentActivityCard } from "@/components/budget/RecentActivityCard";
import { BUDGET_KPIS } from "@/lib/budgetMockData";

export type BudgetTab = "summary" | "pnl" | "cash-flow" | "balance-sheet";

const TAB_PLACEHOLDERS: Record<Exclude<BudgetTab, "summary">, string> = {
  "pnl": "P&L Detail View Placeholder",
  "cash-flow": "Cash Flow Detail View Placeholder",
  "balance-sheet": "Balance Sheet Detail View Placeholder",
};

export default function BudgetDashboardPage({ tab = "summary" }: { tab?: BudgetTab }) {
  return (
    <BudgetLayout title="Budget Overview" subtitle="Plan, track and manage your budgets" showTabs>
      {tab === "summary" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {BUDGET_KPIS.map((kpi, idx) => (
              <BudgetKpiCard key={idx} {...kpi} type={kpi.type as any} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <BudgetVsPriorYearChart />
            </div>
            <div className="lg:col-span-1">
              <BudgetCategoryChart />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <BudgetTable />
            </div>
            <div className="lg:col-span-1 space-y-6">
              <BudgetSummaryCard />
              <RecentActivityCard />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-500 bg-white rounded-lg border border-slate-200 border-dashed">
          {TAB_PLACEHOLDERS[tab]}
        </div>
      )}
    </BudgetLayout>
  );
}
