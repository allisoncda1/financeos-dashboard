import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { AlertCircle } from "lucide-react";

export default function BudgetAssumptionsPage() {
  return (
    <BudgetLayout title="Assumptions" subtitle="Document the assumptions behind your budget">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Budget assumptions not configured</p>
          <p className="text-[13px] text-gray-500 mt-2 max-w-xl">
            Budget assumption tracking (growth rates, headcount drivers, cost escalators) requires
            a FinanceOS budget engine. This feature is not yet implemented. Budget vs. actual
            comparison against existing budgets is available on the{" "}
            <a href="/budget" className="text-emerald-600 hover:underline">Budget Overview</a> page.
          </p>
        </div>
      </div>
    </BudgetLayout>
  );
}
