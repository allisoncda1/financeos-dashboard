import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { AlertCircle } from "lucide-react";

export default function CommissionClientsPage() {
  return (
    <CommissionLayout title="Clients" subtitle="Client commission assignments and rates">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4" data-testid="commission-clients-unavailable">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-1" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Client commission data not available</p>
          <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
            Client-level commission tracking requires a commission engine with invoice eligibility rules
            and client-to-sales-rep assignments. Not yet implemented in FinanceOS.
          </p>
        </div>
      </div>
    </CommissionLayout>
  );
}
