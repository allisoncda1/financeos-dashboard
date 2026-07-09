import { usePortfolioBudget } from "@/hooks/useApi";
import { ENTITY_CONFIG, type EntitySlug } from "@/lib/entities";
import { LayoutDashboard } from "lucide-react";

function fmt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
}

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export default function BudgetOverviewPage() {
  const { data, source } = usePortfolioBudget();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="w-5 h-5 text-emerald-400" />
        <h1 className="text-xl font-semibold text-white">Budget Overview</h1>
        {source === "loading" && <span className="text-xs text-white/40">Loading…</span>}
        {source === "mock" && <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">mock</span>}
      </div>

      {!data && source !== "loading" && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
          No budget data available. Use the Budget Builder to enter targets.
        </div>
      )}

      {data && (
        <>
          {/* Portfolio KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Budget Revenue", value: fmt(data.portfolio_budget_revenue) },
              { label: "Actual Revenue", value: fmt(data.portfolio_actual_revenue) },
              { label: "Variance", value: fmt(data.portfolio_variance_revenue), color: data.portfolio_variance_revenue >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "Attainment", value: fmtPct(data.portfolio_attainment_pct), color: (data.portfolio_attainment_pct ?? 0) >= 95 ? "text-emerald-400" : (data.portfolio_attainment_pct ?? 0) >= 80 ? "text-amber-400" : "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/50 mb-1">{label}</p>
                <p className={`text-xl font-semibold ${color ?? "text-white"}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Entity breakdown */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Entity</th>
                  <th className="text-right px-4 py-3">Budget Rev</th>
                  <th className="text-right px-4 py-3">Actual Rev</th>
                  <th className="text-right px-4 py-3">Attainment</th>
                  <th className="text-right px-4 py-3">Budget NI</th>
                  <th className="text-right px-4 py-3">Actual NI</th>
                </tr>
              </thead>
              <tbody>
                {data.entity_budgets.map((e) => {
                  const cfg = ENTITY_CONFIG[e.slug as EntitySlug];
                  return (
                    <tr key={e.slug} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>
                        {cfg?.name ?? e.slug}
                      </td>
                      <td className="px-4 py-3 text-right text-white/80">{fmt(e.budget_revenue)}</td>
                      <td className="px-4 py-3 text-right text-white/80">{fmt(e.actual_revenue)}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{
                        color: e.attainment_pct === null ? undefined
                          : e.attainment_pct >= 95 ? "#34d399"
                          : e.attainment_pct >= 80 ? "#fbbf24"
                          : "#f87171",
                      }}>
                        {fmtPct(e.attainment_pct)}
                      </td>
                      <td className="px-4 py-3 text-right text-white/80">{fmt(e.budget_net_income)}</td>
                      <td className="px-4 py-3 text-right" style={{ color: e.actual_net_income >= 0 ? "#34d399" : "#f87171" }}>
                        {fmt(e.actual_net_income)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-white/30">
            {data.months_with_budgets} / 12 months have budget targets · {data.entity_slugs.length} entities · {data.year}
          </p>
        </>
      )}
    </div>
  );
}
