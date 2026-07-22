import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { AlertCircle } from "lucide-react";

export default function FixedAssetsPage() {
  return (
    <AccountingLayout title="Fixed Assets" subtitle="Asset register and depreciation">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Fixed asset register not available</p>
          <p className="text-[13px] text-gray-500 mt-2 max-w-xl">
            Fixed asset tracking and depreciation schedules require a dedicated asset management engine.
            QBO fixed asset data is not yet included in the FinanceOS Core pipeline.
            This feature is planned for a future release.
          </p>
          <p className="text-[12px] text-gray-400 mt-3">
            Data source requirement: <code className="bg-gray-100 px-1 rounded text-[11px]">fixed_assets</code> table
            with depreciation schedules — not currently available in the Core pipeline.
          </p>
        </div>
      </div>
    </AccountingLayout>
  );
}
