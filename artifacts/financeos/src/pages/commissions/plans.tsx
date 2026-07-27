import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { AlertCircle } from "lucide-react";

export default function CommissionPlansPage() {
  return (
    <CommissionLayout title="Commission Plans" subtitle="Define and manage commission plan structures">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4" data-testid="commission-plans-unavailable">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-1" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Commission plans not configured</p>
          <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
            Commission plan management requires a commission engine backend. Plans define eligibility rules,
            rate tiers, and payout schedules per entity and sales rep. Not yet implemented in FinanceOS.
          </p>
        </div>
      </div>
    </CommissionLayout>
  );
}
