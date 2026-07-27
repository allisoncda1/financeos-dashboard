import { AlertCircle } from "lucide-react";

export function CommissionRepChart() {
  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-6 flex items-start gap-4" data-testid="commission-rep-chart-unavailable">
      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-[13px] font-semibold text-gray-900">Commission by sales rep not available</p>
        <p className="text-[12px] text-gray-500 mt-1">
          Rep-level commission breakdown requires entity-specific sales rep assignments and a commission engine.
          Not yet implemented.
        </p>
      </div>
    </div>
  );
}
