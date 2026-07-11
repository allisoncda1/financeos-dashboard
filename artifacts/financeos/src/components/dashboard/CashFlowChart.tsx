// Cash Flow — FinanceOS Core does not yet publish a cash-flow statement
// (financials.cash_flow is null). Rather than approximate cash in/out from
// P&L figures (which would be fabricated), this card shows an explicit
// "not available yet" state until the pipeline provides real cash-flow data.

export function CashFlowChart() {
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
