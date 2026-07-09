import { useEntityBudget } from "@/hooks/useApi";
import { useBudgetEntity } from "@/lib/budget-context";
import { ENTITY_CONFIG, ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import { Droplets, Info } from "lucide-react";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export default function BudgetCashFlowPage() {
  const { activeSlug, setActiveSlug } = useBudgetEntity();
  const { data, source } = useEntityBudget(activeSlug);

  const months = data?.months ?? [];

  // Simplified projection: cumulative net income as proxy for cash flow
  // Each future month: prior month cash + budget net income target
  // Past months: actual cash data not available here — shows "—"
  let cumulativeNI = 0;
  const rows = months.map((m, i) => {
    const ni = m.net_income_target ?? 0;
    cumulativeNI += ni;
    const mIdx = parseInt(m.period_start.slice(5, 7), 10) - 1;
    return { label: MONTHS_SHORT[mIdx] ?? m.period_start, period_start: m.period_start, ni, cumulativeNI };
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Droplets className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-semibold text-white">Budget Cash Flow</h1>
          {source === "loading" && <span className="text-xs text-white/40">Loading…</span>}
        </div>

        <select
          value={activeSlug}
          onChange={(e) => setActiveSlug(e.target.value as EntitySlug)}
          className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500/50"
        >
          {ENTITY_SLUGS.map((s) => (
            <option key={s} value={s} className="bg-zinc-900">
              {ENTITY_CONFIG[s]?.name ?? s}
            </option>
          ))}
        </select>
      </div>

      {/* Approximation notice */}
      <div className="flex gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/50">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-white/30" />
        <span>
          Cash flow is estimated from budget net income targets. Full indirect method (capex, depreciation, working capital)
          is coming in V2.
        </span>
      </div>

      {!data && source !== "loading" && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
          No budget data. Use the Budget Builder to enter targets.
        </div>
      )}

      {data && rows.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="border-b border-white/10 text-white/50 uppercase tracking-wide">
                <th className="text-left px-3 py-2.5">Month</th>
                <th className="text-right px-3 py-2.5">Budget Net Income</th>
                <th className="text-right px-3 py-2.5">Cumulative (est.)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period_start} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-3 py-2 text-white/70 font-medium">{r.label}</td>
                  <td className={`px-3 py-2 text-right ${r.ni >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fmt(r.ni)}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${r.cumulativeNI >= 0 ? "text-white/80" : "text-red-400"}`}>
                    {fmt(r.cumulativeNI)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
