import { AlertCircle } from "lucide-react";

export function BudgetVsPriorYearChart() {
  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-6 flex items-start gap-4" data-testid="budget-vs-prior-year-unavailable">
      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-[13px] font-semibold text-gray-900">Budget vs. Prior Year chart not available</p>
        <p className="text-[12px] text-gray-500 mt-1">
          Year-over-year budget comparison requires a configured budget engine and prior-year actuals. Not yet implemented.
        </p>
      </div>
    </div>
  );
}
