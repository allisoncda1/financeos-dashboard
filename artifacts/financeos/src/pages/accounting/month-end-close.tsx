import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { AlertCircle } from "lucide-react";

export default function MonthEndClosePage() {
  return (
    <AccountingLayout title="Month-End Close" subtitle="Monthly close checklist and workflow">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Month-end close workflow not available</p>
          <p className="text-[13px] text-gray-500 mt-2 max-w-xl">
            The month-end close checklist requires an operational workflow engine to track task state,
            ownership, and close history across periods. This is not derived from QBO data and
            requires FinanceOS-native workflow tracking.
            This feature is planned for a future release.
          </p>
          <p className="text-[12px] text-gray-400 mt-3">
            Data source requirement: FinanceOS close workflow engine (operational DB table
            <code className="bg-gray-100 px-1 rounded text-[11px] ml-1">close_tasks</code>) — not yet implemented.
          </p>
        </div>
      </div>
    </AccountingLayout>
  );
}
