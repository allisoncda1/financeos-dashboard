import { useBudgetVsActual } from "@/hooks/useApi";
import { useBudgetEntity } from "@/lib/budget-context";
import { ENTITY_CONFIG } from "@/lib/entities";
import { BudgetLayout } from "@/components/budget/BudgetLayout";

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
  if (n === null) return "text-gray-400";
  const favorable = isExpense ? n <= 0 : n >= 0;
  return favorable ? "text-emerald-600" : "text-red-500";
}

export default function BudgetVsActualPage() {
  const { activeSlug } = useBudgetEntity();
  const { data, source } = useBudgetVsActual(activeSlug);

  const entityName = ENTITY_CONFIG[activeSlug]?.name ?? activeSlug;

  return (
    <BudgetLayout title="Budget vs Actual" subtitle={`Plan versus actuals · ${entityName}`}>
      {source === "loading" && <p className="text-sm text-gray-400">Loading…</p>}

      {!data && source !== "loading" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          No data available for {entityName}.
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* YTD summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(["revenue", "cogs", "opex", "net_income"] as const).map((key) => {
              const label = { revenue: "Revenue", cogs: "COGS", opex: "Opex", net_income: "Net Income" }[key];
              const isExp = key === "cogs" || key === "opex";
              const v = data.ytd.variance[key];
              return (
                <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">
                    YTD {label} Variance
                  </p>
                  <p className={`text-[20px] font-bold leading-tight ${varianceColor(v, isExp)}`}>{fmt(v)}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Budget {fmt(data.ytd.budget[key])} · Actual {fmt(data.ytd.actual[key])}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Monthly table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
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
                      <tr
                        key={m.month}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-3 py-2 font-medium text-gray-700">{label}</td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {m.has_budget ? fmt(m.budget.revenue) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {m.has_actual ? fmt(m.actual?.revenue ?? null) : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${varianceColor(m.variance_pct.revenue)}`}>
                          {m.has_budget && m.has_actual ? fmtPct(m.variance_pct.revenue) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {m.has_budget ? fmt(m.budget.opex) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {m.has_actual ? fmt(m.actual?.opex ?? null) : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${varianceColor(m.variance_pct.opex, true)}`}>
                          {m.has_budget && m.has_actual ? fmtPct(m.variance_pct.opex) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {m.has_budget ? fmt(m.budget.net_income) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {m.has_actual ? fmt(m.actual?.net_income ?? null) : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${varianceColor(m.variance_pct.net_income)}`}>
                          {m.has_budget && m.has_actual ? fmtPct(m.variance_pct.net_income) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            "—" in variance columns = budget not entered for that month · {data.year}
          </p>
        </div>
      )}
    </BudgetLayout>
  );
}
