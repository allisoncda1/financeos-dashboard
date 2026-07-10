import { usePortfolioBudget } from "@/hooks/useApi";
import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { BudgetKpiCard } from "@/components/budget/BudgetKpiCard";
import { ENTITY_CONFIG, type EntitySlug } from "@/lib/entities";

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

export default function BudgetOverviewPage() {
  const { data, source } = usePortfolioBudget();

  return (
    <BudgetLayout title="Budget Overview" subtitle="Plan, track and manage your budgets" showTabs>
      {source === "loading" && (
        <p className="text-sm text-gray-400">Loading budget data…</p>
      )}

      {!data && source !== "loading" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          No budget data available yet. Use the{" "}
          <span className="font-medium text-gray-700">Budget Builder</span> to enter targets.
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Live portfolio KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <BudgetKpiCard
              title="Budget Revenue"
              value={fmt(data.portfolio_budget_revenue)}
              change=""
              vs="FY2026 target"
              type="revenue"
            />
            <BudgetKpiCard
              title="Actual Revenue"
              value={fmt(data.portfolio_actual_revenue)}
              change=""
              vs="YTD actual"
              type="income"
            />
            <BudgetKpiCard
              title="Revenue Variance"
              value={fmt(data.portfolio_variance_revenue)}
              change=""
              vs="actual vs budget"
              type={data.portfolio_variance_revenue >= 0 ? "revenue" : "expense"}
            />
            <BudgetKpiCard
              title="Attainment"
              value={fmtPct(data.portfolio_attainment_pct)}
              change=""
              vs="of revenue target"
              type="completion"
            />
          </div>

          {/* Live entity breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Entity Breakdown</h3>
              <span className="text-[11px] text-gray-400">
                {data.months_with_budgets}/12 months with targets · {data.year}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5">Entity</th>
                    <th className="text-right px-4 py-2.5">Budget Rev</th>
                    <th className="text-right px-4 py-2.5">Actual Rev</th>
                    <th className="text-right px-4 py-2.5">Attainment</th>
                    <th className="text-right px-4 py-2.5">Budget NI</th>
                    <th className="text-right px-4 py-2.5">Actual NI</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entity_budgets.map((e) => {
                    const cfg = ENTITY_CONFIG[e.slug as EntitySlug];
                    const att = e.attainment_pct;
                    const attColor =
                      att === null
                        ? "text-gray-400"
                        : att >= 95
                        ? "text-emerald-600"
                        : att >= 80
                        ? "text-amber-600"
                        : "text-red-500";
                    return (
                      <tr
                        key={e.slug}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>
                          {cfg?.name ?? e.slug}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(e.budget_revenue)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(e.actual_revenue)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${attColor}`}>{fmtPct(att)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(e.budget_net_income)}</td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${
                            e.actual_net_income >= 0 ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {fmt(e.actual_net_income)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </BudgetLayout>
  );
}
