import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { AlertCircle } from "lucide-react";

export default function CommissionReportsPage() {
  return (
    <CommissionLayout title="Reports" subtitle="Commission reports and statements">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4" data-testid="commission-reports-unavailable">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-1" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Commission reports not available</p>
          <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
            Commission reports require completed calculation runs. Reports will be available once the commission
            engine is configured and calculation runs have been approved. Not yet implemented in FinanceOS.
          </p>
        </div>
      </div>
    </CommissionLayout>
  );
}
