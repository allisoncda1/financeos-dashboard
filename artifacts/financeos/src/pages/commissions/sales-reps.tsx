import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { AlertCircle } from "lucide-react";

export default function SalesRepsPage() {
  return (
    <CommissionLayout title="Sales Reps" subtitle="Sales representative commission performance">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4" data-testid="commission-sales-reps-unavailable">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-1" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Sales rep data not available</p>
          <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
            Sales rep commission tracking requires entity-specific rep assignments and a commission engine
            with calculation runs. Not yet implemented in FinanceOS.
          </p>
        </div>
      </div>
    </CommissionLayout>
  );
}
