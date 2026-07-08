import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { BudgetKpiCard } from "@/components/budget/BudgetKpiCard";
import { BudgetVsPriorYearChart } from "@/components/budget/BudgetVsPriorYearChart";
import { BudgetCategoryChart } from "@/components/budget/BudgetCategoryChart";
import { BudgetTable } from "@/components/budget/BudgetTable";
import { BudgetSummaryCard } from "@/components/budget/BudgetSummaryCard";
import { RecentActivityCard } from "@/components/budget/RecentActivityCard";
import { BudgetDetailTable } from "@/components/budget/BudgetDetailTable";
import { MiniKpi } from "@/components/accounting/AccountingUI";
import {
  BUDGET_KPIS,
  BUDGET_PNL_DETAIL,
  BUDGET_CASH_FLOW_DETAIL,
  BUDGET_BALANCE_SHEET_DETAIL,
} from "@/lib/budgetMockData";

export type BudgetTab = "summary" | "pnl" | "cash-flow" | "balance-sheet";

function PnlDetailView() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Budgeted Net Income" value="$3.15M" sub="18.1% of revenue" tone="emerald" />
        <MiniKpi label="Budgeted Gross Margin" value="62.1%" sub="+1.2 pts vs FY2025" tone="emerald" />
        <MiniKpi label="Total Opex Budget" value="$7.66M" sub="44.0% of revenue" tone="gray" />
      </div>
      <BudgetDetailTable title="P&L Budget (FY2026)" rows={BUDGET_PNL_DETAIL} />
    </div>
  );
}

function CashFlowDetailView() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Cash from Operations" value="$3.09M" sub="FY2026 budget" tone="emerald" />
        <MiniKpi label="Net Change in Cash" value="$1.55M" sub="After investing & financing" tone="emerald" />
        <MiniKpi label="Owner Distributions" value="($1.10M)" sub="Planned FY2026" tone="gray" />
      </div>
      <BudgetDetailTable title="Cash Flow Budget (FY2026)" rows={BUDGET_CASH_FLOW_DETAIL} />
    </div>
  );
}

function BalanceSheetDetailView() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Projected Total Assets" value="$5.56M" sub="End of FY2026" tone="gray" />
        <MiniKpi label="Projected Total Equity" value="$4.59M" sub="End of FY2026" tone="emerald" />
        <MiniKpi label="Projected Cash" value="$3.40M" sub="End of FY2026" tone="emerald" />
      </div>
      <BudgetDetailTable title="Balance Sheet Budget (FY2026)" rows={BUDGET_BALANCE_SHEET_DETAIL} totalLabel="EOY FY2026" />
    </div>
  );
}

const TAB_VIEWS: Record<Exclude<BudgetTab, "summary">, () => React.JSX.Element> = {
  "pnl": PnlDetailView,
  "cash-flow": CashFlowDetailView,
  "balance-sheet": BalanceSheetDetailView,
};

export default function BudgetDashboardPage({ tab = "summary" }: { tab?: BudgetTab }) {
  return (
    <BudgetLayout title="Budget Overview" subtitle="Plan, track and manage your budgets" showTabs>
      {tab === "summary" ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {BUDGET_KPIS.map((kpi, idx) => (
              <BudgetKpiCard key={idx} {...kpi} type={kpi.type as any} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2">
              <BudgetVsPriorYearChart />
            </div>
            <div className="lg:col-span-1">
              <BudgetCategoryChart />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="lg:col-span-3">
              <BudgetTable />
            </div>
            <div className="lg:col-span-1 space-y-4 sm:space-y-6">
              <BudgetSummaryCard />
              <RecentActivityCard />
            </div>
          </div>
        </div>
      ) : (
        (() => {
          const View = TAB_VIEWS[tab];
          return <View />;
        })()
      )}
    </BudgetLayout>
  );
}
