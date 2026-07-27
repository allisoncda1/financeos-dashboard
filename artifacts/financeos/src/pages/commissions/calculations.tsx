import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { AlertCircle } from "lucide-react";

export default function CommissionCalculationsPage() {
  return (
    <CommissionLayout title="Calculations" subtitle="Commission calculation runs and results">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4" data-testid="commission-calculations-unavailable">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-1" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Commission calculations not available</p>
          <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
            Calculation runs require a commission engine with:
          </p>
          <ul className="text-[12px] text-gray-500 mt-2 space-y-1 list-disc list-inside">
            <li>Commission plan definitions per entity</li>
            <li>Invoice eligibility rules (commissionable vs. non-commissionable)</li>
            <li>Entity-specific sales rep assignments</li>
            <li>Approved payout schedule configuration</li>
          </ul>
          <p className="text-[12px] text-gray-400 mt-3">Not yet implemented in FinanceOS.</p>
        </div>
      </div>
    </CommissionLayout>
  );
}
