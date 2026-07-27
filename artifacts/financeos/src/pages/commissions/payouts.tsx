import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { UpcomingPayoutCard } from "@/components/commission/UpcomingPayoutCard";
import { AlertCircle } from "lucide-react";

export default function CommissionPayoutsPage() {
  return (
    <CommissionLayout title="Payouts" subtitle="Commission payout schedules and history">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4" data-testid="commission-payouts-unavailable">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-1" />
            <div>
              <p className="text-[14px] font-semibold text-gray-900">Payout history not available</p>
              <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
                Payout history requires approved commission calculation runs. Not yet implemented in FinanceOS.
              </p>
            </div>
          </div>
        </div>
        <div>
          <UpcomingPayoutCard />
        </div>
      </div>
    </CommissionLayout>
  );
}
