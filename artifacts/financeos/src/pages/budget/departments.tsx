import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { AlertCircle } from "lucide-react";

export default function BudgetDepartmentsPage() {
  return (
    <BudgetLayout title="Departments" subtitle="Department-level budget allocation and tracking">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Department budget allocation not configured</p>
          <p className="text-[13px] text-gray-500 mt-2 max-w-xl">
            Splitting a total budget across departments (Engineering, Sales, Marketing, G&amp;A) requires
            a department mapping to QBO classes or locations. No department-to-account mapping has been
            configured for this entity. This feature requires a cost center allocation engine.
          </p>
          <p className="text-[12px] text-gray-400 mt-3">
            Prerequisite: department-to-QBO-class mapping in FinanceOS — not yet implemented.
          </p>
        </div>
      </div>
    </BudgetLayout>
  );
}
