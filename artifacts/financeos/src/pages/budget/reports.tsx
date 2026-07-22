import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { AlertCircle } from "lucide-react";

export default function BudgetReportsPage() {
  return (
    <BudgetLayout title="Reports" subtitle="Budget reports and exports">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Budget report exports not configured</p>
          <p className="text-[13px] text-gray-500 mt-2 max-w-xl">
            Packaged budget report exports (PDF, Excel, Board Pack) require a report generation engine
            configured for budget templates. The FinanceOS report generator supports financial statement
            reports — budget-specific templates are planned for a future release.
          </p>
        </div>
      </div>
    </BudgetLayout>
  );
}
