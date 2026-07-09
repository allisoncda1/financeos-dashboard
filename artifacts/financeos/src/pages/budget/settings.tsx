import { Settings } from "lucide-react";

export default function BudgetSettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-emerald-400" />
        <h1 className="text-xl font-semibold text-white">Budget Settings</h1>
        <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded">V2</span>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Fiscal Year</p>
            <p className="text-xs text-white/40">January – December</p>
          </div>
          <span className="text-xs text-white/30 border border-white/10 rounded px-2 py-1">Default</span>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div>
            <p className="text-sm font-medium text-white">Currency</p>
            <p className="text-xs text-white/40">US Dollar (USD)</p>
          </div>
          <span className="text-xs text-white/30 border border-white/10 rounded px-2 py-1">Default</span>
        </div>
      </div>
      <p className="text-xs text-white/30">
        Configurable fiscal year and multi-currency support coming in V2.
      </p>
    </div>
  );
}
