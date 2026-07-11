import { useEntityBudget } from "@/hooks/useApi";
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
  return `${n.toFixed(1)}%`;
}

export default function BudgetPnLPage() {
  const { activeSlug } = useBudgetEntity();
  const { data, source } = useEntityBudget(activeSlug);

  const months = data?.months ?? [];

  const rows = months.map((m) => {
    const grossProfit =
      m.revenue_target !== null && m.cogs_target !== null ? m.revenue_target - m.cogs_target : null;
    const grossMargin =
      grossProfit !== null && m.revenue_target ? (grossProfit / m.revenue_target) * 100 : null;
    const netMargin =
      m.net_income_target !== null && m.revenue_target
        ? (m.net_income_target / m.revenue_target) * 100
        : null;
    const mIdx = parseInt(m.period_start.slice(5, 7), 10) - 1;
    return { ...m, grossProfit, grossMargin, netMargin, label: MONTHS_SHORT[mIdx] ?? m.period_start };
  });

  const ytd = {
    revenue: rows.reduce((s, r) => s + (r.revenue_target ?? 0), 0),
    cogs: rows.reduce((s, r) => s + (r.cogs_target ?? 0), 0),
    opex: rows.reduce((s, r) => s + (r.opex_target ?? 0), 0),
    net_income: rows.reduce((s, r) => s + (r.net_income_target ?? 0), 0),
  };
  const ytdGrossProfit = ytd.revenue - ytd.cogs;
  const ytdGrossMargin = ytd.revenue > 0 ? (ytdGrossProfit / ytd.revenue) * 100 : null;
  const ytdNetMargin = ytd.revenue > 0 ? (ytd.net_income / ytd.revenue) * 100 : null;

  const entityName = ENTITY_CONFIG[activeSlug]?.name ?? activeSlug;

  return (
    <BudgetLayout title="Budget P&L" subtitle={`Projected income statement · ${entityName}`} showTabs>
      {source === "loading" && <p className="text-sm text-gray-400">Loading…</p>}

      {!data && source !== "loading" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          No budget data. Use the Budget Builder to enter targets.
        </div>
      )}

      {data && rows.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          No monthly targets entered for {entityName} {data.year}.
        </div>
      )}

      {data && rows.length > 0 && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Annual Revenue", value: fmt(ytd.revenue), color: "text-gray-900" },
              { label: "Gross Margin", value: fmtPct(ytdGrossMargin), color: "text-gray-900" },
              { label: "Annual Opex", value: fmt(ytd.opex), color: "text-gray-900" },
              {
                label: "Net Margin",
                value: fmtPct(ytdNetMargin),
                color: ytdNetMargin !== null && ytdNetMargin >= 0 ? "text-emerald-600" : "text-red-500",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">{label}</p>
                <p className={`text-[22px] font-bold leading-tight ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Monthly P&L table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-3 py-2.5">Month</th>
                    <th className="text-right px-3 py-2.5">Revenue</th>
                    <th className="text-right px-3 py-2.5">COGS</th>
                    <th className="text-right px-3 py-2.5">Gross Profit</th>
                    <th className="text-right px-3 py-2.5">GM%</th>
                    <th className="text-right px-3 py-2.5">Opex</th>
                    <th className="text-right px-3 py-2.5">Net Income</th>
                    <th className="text-right px-3 py-2.5">NM%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.period_start}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-2 font-medium text-gray-700">{r.label}</td>
                      <td className="px-3 py-2 text-right text-gray-800">{fmt(r.revenue_target)}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{fmt(r.cogs_target)}</td>
                      <td className="px-3 py-2 text-right text-gray-800">{fmt(r.grossProfit)}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{fmtPct(r.grossMargin)}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{fmt(r.opex_target)}</td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          r.net_income_target === null
                            ? "text-gray-400"
                            : r.net_income_target >= 0
                            ? "text-emerald-600"
                            : "text-red-500"
                        }`}
                      >
                        {fmt(r.net_income_target)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">{fmtPct(r.netMargin)}</td>
                    </tr>
                  ))}
                  {/* Annual total */}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-3 py-2.5 text-gray-800">Annual Total</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{fmt(ytd.revenue)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{fmt(ytd.cogs)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{fmt(ytdGrossProfit)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{fmtPct(ytdGrossMargin)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{fmt(ytd.opex)}</td>
                    <td
                      className={`px-3 py-2.5 text-right ${
                        ytd.net_income >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {fmt(ytd.net_income)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{fmtPct(ytdNetMargin)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            Projected income statement · {data.year} · {data.months_with_budgets} months with targets
          </p>
        </div>
      )}
    </BudgetLayout>
  );
}
