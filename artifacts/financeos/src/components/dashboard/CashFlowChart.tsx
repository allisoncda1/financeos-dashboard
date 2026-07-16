import { formatCurrency } from "@/lib/format";
import type { CashFlowStatement } from "@/lib/types";

type Props = { data: CashFlowStatement | null };

export function CashFlowChart({ data }: Props) {
  if (!data || data.sections.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-1">
            Cash Flow Summary
          </p>
        </div>
        <div className="py-8 flex flex-col items-center justify-center text-center gap-1">
          <p className="text-[12px] text-gray-400 font-medium">Not available yet</p>
          <p className="text-[10px] text-gray-400 leading-relaxed max-w-[200px]">
            No cash-flow statement is published by the pipeline for this entity yet.
          </p>
        </div>
      </div>
    );
  }

  const netChange = data.net_cash_change;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
        Cash Flow Summary
      </p>

      <div className="space-y-2">
        {data.sections.map((section) => (
          <div key={section.name} className="flex items-center justify-between">
            <span className="text-[11px] text-gray-600 truncate max-w-[130px]">{section.name}</span>
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{ color: section.net_cash >= 0 ? "#10B981" : "#EF4444" }}
            >
              {formatCurrency(section.net_cash)}
            </span>
          </div>
        ))}
      </div>

      {netChange !== null && (
        <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
          <span className="text-[11px] text-gray-500 font-semibold">Net Change</span>
          <span
            className="text-[11px] font-bold tabular-nums"
            style={{ color: netChange >= 0 ? "#10B981" : "#EF4444" }}
          >
            {formatCurrency(netChange)}
          </span>
        </div>
      )}

      {data.cash_at_end !== null && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">Cash at End</span>
          <span className="text-[10px] text-gray-500 tabular-nums font-medium">
            {formatCurrency(data.cash_at_end)}
          </span>
        </div>
      )}
    </div>
  );
}
