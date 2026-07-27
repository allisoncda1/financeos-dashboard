import { AlertCircle } from "lucide-react";

export function BudgetDetailTable({ title }: { title?: string; rows?: unknown[]; totalLabel?: string }) {
  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-6 flex items-start gap-4" data-testid="budget-detail-table-unavailable">
      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-[13px] font-semibold text-gray-900">{title ?? "Budget detail"} not available</p>
        <p className="text-[12px] text-gray-500 mt-1">
          Detailed budget line items require a configured budget engine. Not yet implemented.
        </p>
      </div>
    </div>
  );
}
