import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Scale } from "lucide-react";

export default function BudgetBalanceSheetPage() {
  return (
    <BudgetLayout title="Balance Sheet Budget" subtitle="Projected financial position" showTabs>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <Scale className="w-6 h-6 text-emerald-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Balance sheet budgeting is coming soon</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Live budget targets currently cover the income statement (revenue, COGS, Opex, net income), visible in
          the <span className="font-medium text-gray-700">P&amp;L</span> and{" "}
          <span className="font-medium text-gray-700">Budget vs Actual</span> views. Balance sheet projections
          will arrive in a future release.
        </p>
        <span className="inline-block mt-4 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 rounded-full px-3 py-1">
          Preview · V2
        </span>
      </div>
    </BudgetLayout>
  );
}
