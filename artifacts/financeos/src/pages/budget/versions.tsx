import { GitBranch } from "lucide-react";

export default function BudgetVersionsPage() {
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <GitBranch className="w-5 h-5 text-emerald-400" />
        <h1 className="text-xl font-semibold text-white">Budget Versions</h1>
        <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded">V2</span>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Version</th>
              <th className="text-left px-4 py-3">Label</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3 text-white/80 font-medium">v1</td>
              <td className="px-4 py-3 text-white/60">Current Budget</td>
              <td className="px-4 py-3 text-white/50">{now}</td>
              <td className="px-4 py-3">
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Active</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-white/30">
        Version history and scenario comparisons are coming in V2.
      </p>
    </div>
  );
}
