import { Scale } from "lucide-react";

export default function BudgetBalanceSheetPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Scale className="w-5 h-5 text-emerald-400" />
        <h1 className="text-xl font-semibold text-white">Projected Balance Sheet</h1>
        <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded">V2</span>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center space-y-3">
        <Scale className="w-10 h-10 text-white/20 mx-auto" />
        <p className="text-white/60 font-medium">Balance sheet projections coming in V2</p>
        <p className="text-white/30 text-sm max-w-md mx-auto">
          Projected balance sheets require equity schedules, debt amortization, and capex targets —
          beyond the scope of Budget V1. Actuals are available in the Entity pages.
        </p>
      </div>
    </div>
  );
}
