import { AlertCircle } from "lucide-react";

export function CommissionKPICards() {
  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-6 flex items-start gap-4" data-testid="commission-kpi-unavailable">
      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-[13px] font-semibold text-gray-900">Commission metrics not available</p>
        <p className="text-[12px] text-gray-500 mt-1">
          Commission KPIs require a commission engine with invoice eligibility rules, commission plans,
          and entity-specific sales rep assignments. Not yet implemented.
        </p>
      </div>
    </div>
  );
}
