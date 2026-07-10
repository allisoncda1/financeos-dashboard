import { useBudgetVsActual } from "@/hooks/useApi";
import { useBudgetEntity } from "@/lib/budget-context";
import { ENTITY_CONFIG, ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import { GitCompare } from "lucide-react";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function varianceColor(n: number | null, isExpense = false): string {
  if (n === null) return "text-white/40";
  // For expenses (cogs, opex): negative variance is favorable
  const favorable = isExpense ? n <= 0 : n >= 0;
  return favorable ? "text-emerald-400" : "text-red-400";
}

export default function BudgetVsActualPage() {
  const { activeSlug, setActiveSlug } = useBudgetEntity();
  const { data, source } = useBudgetVsActual(activeSlug);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitCompare className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-semibold text-white">Budget vs Actual</h1>
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

      {!data && source !== "loading" && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
          No data available for {ENTITY_CONFIG[activeSlug]?.name ?? activeSlug}.
        </div>
      )}

      {data && (
        <>
          {/* YTD Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(["revenue", "cogs", "opex", "net_income"] as const).map((key) => {
              const label = { revenue: "Revenue", cogs: "COGS", opex: "Opex", net_income: "Net Income" }[key];
              const isExp = key === "cogs" || key === "opex";
              const v = data.ytd.variance[key];
              return (
                <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50 mb-1">YTD {label} Variance</p>
                  <p className={`text-lg font-semibold ${varianceColor(v, isExp)}`}>{fmt(v)}</p>
                  <p className="text-xs text-white/40 mt-1">
                    Budget {fmt(data.ytd.budget[key])} · Actual {fmt(data.ytd.actual[key])}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Monthly table */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="border-b border-white/10 text-white/50 uppercase tracking-wide">
                  <th className="text-left px-3 py-2.5">Month</th>
                  <th className="text-right px-3 py-2.5">Bud Rev</th>
                  <th className="text-right px-3 py-2.5">Act Rev</th>
                  <th className="text-right px-3 py-2.5">Rev Var%</th>
                  <th className="text-right px-3 py-2.5">Bud Opex</th>
                  <th className="text-right px-3 py-2.5">Act Opex</th>
                  <th className="text-right px-3 py-2.5">Opex Var%</th>
                  <th className="text-right px-3 py-2.5">Bud NI</th>
                  <th className="text-right px-3 py-2.5">Act NI</th>
                  <th className="text-right px-3 py-2.5">NI Var%</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => {
                  const mIdx = parseInt(m.month.slice(5, 7), 10) - 1;
                  const label = MONTHS_SHORT[mIdx] ?? m.month;
                  return (
                    <tr key={m.month} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2 text-white/70 font-medium">{label}</td>
                      <td className="px-3 py-2 text-right text-white/60">{m.has_budget ? fmt(m.budget.revenue) : "—"}</td>
                      <td className="px-3 py-2 text-right text-white/80">{m.has_actual ? fmt(m.actual?.revenue ?? null) : "—"}</td>
                      <td className={`px-3 py-2 text-right font-medium ${varianceColor(m.variance_pct.revenue)}`}>
                        {m.has_budget && m.has_actual ? fmtPct(m.variance_pct.revenue) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-white/60">{m.has_budget ? fmt(m.budget.opex) : "—"}</td>
                      <td className="px-3 py-2 text-right text-white/80">{m.has_actual ? fmt(m.actual?.opex ?? null) : "—"}</td>
                      <td className={`px-3 py-2 text-right font-medium ${varianceColor(m.variance_pct.opex, true)}`}>
                        {m.has_budget && m.has_actual ? fmtPct(m.variance_pct.opex) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-white/60">{m.has_budget ? fmt(m.budget.net_income) : "—"}</td>
                      <td className="px-3 py-2 text-right text-white/80">{m.has_actual ? fmt(m.actual?.net_income ?? null) : "—"}</td>
                      <td className={`px-3 py-2 text-right font-medium ${varianceColor(m.variance_pct.net_income)}`}>
                        {m.has_budget && m.has_actual ? fmtPct(m.variance_pct.net_income) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-white/30">
            "—" in variance columns = budget not entered for that month · {data.year}
          </p>
        </>
      )}
    </div>
  );
}
