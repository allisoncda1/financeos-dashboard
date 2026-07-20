import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { AlertCircle } from "lucide-react";

export default function BudgetVersionsPage() {
  return (
    <BudgetLayout title="Budget Versions" subtitle="Track and compare budget versions over time">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Budget version management not available</p>
          <p className="text-[13px] text-gray-500 mt-2 max-w-xl">
            Saving, comparing, and promoting named budget versions (e.g. "Board-Approved", "Revised Q3")
            requires a versioning engine in the FinanceOS operational database. This feature is not yet
            implemented. The current active budget is accessible on the{" "}
            <a href="/budget" className="text-emerald-600 hover:underline">Budget Overview</a> page.
          </p>
        </div>
      </div>
    </BudgetLayout>
  );
}
