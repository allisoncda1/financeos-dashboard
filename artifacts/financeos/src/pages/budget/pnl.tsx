import { useEntityBudget } from "@/hooks/useApi";
import { useBudgetEntity } from "@/lib/budget-context";
import { ENTITY_CONFIG, ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import { FileText } from "lucide-react";

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
  const { activeSlug, setActiveSlug } = useBudgetEntity();
  const { data, source } = useEntityBudget(activeSlug);

  const months = data?.months ?? [];

  // Derived per month
  const rows = months.map((m) => {
    const grossProfit = m.revenue_target !== null && m.cogs_target !== null
      ? m.revenue_target - m.cogs_target
      : null;
    const grossMargin = grossProfit !== null && m.revenue_target
      ? (grossProfit / m.revenue_target) * 100
      : null;
    const netMargin = m.net_income_target !== null && m.revenue_target
      ? (m.net_income_target / m.revenue_target) * 100
      : null;
    const mIdx = parseInt(m.period_start.slice(5, 7), 10) - 1;
    return { ...m, grossProfit, grossMargin, netMargin, label: MONTHS_SHORT[mIdx] ?? m.period_start };
  });

  // YTD totals
  const ytd = {
    revenue:    rows.reduce((s, r) => s + (r.revenue_target    ?? 0), 0),
    cogs:       rows.reduce((s, r) => s + (r.cogs_target       ?? 0), 0),
    opex:       rows.reduce((s, r) => s + (r.opex_target       ?? 0), 0),
    net_income: rows.reduce((s, r) => s + (r.net_income_target ?? 0), 0),
  };
  const ytdGrossProfit = ytd.revenue - ytd.cogs;
  const ytdGrossMargin = ytd.revenue > 0 ? (ytdGrossProfit / ytd.revenue) * 100 : null;
  const ytdNetMargin   = ytd.revenue > 0 ? (ytd.net_income  / ytd.revenue) * 100 : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-semibold text-white">Budget P&L</h1>
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
          No budget data. Use the Budget Builder to enter targets.
        </div>
      )}

      {data && rows.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
          No monthly targets entered for {ENTITY_CONFIG[activeSlug]?.name ?? activeSlug} {data.year}.
        </div>
      )}

      {data && rows.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Annual Revenue", value: fmt(ytd.revenue) },
              { label: "Gross Margin", value: fmtPct(ytdGrossMargin) },
              { label: "Annual Opex", value: fmt(ytd.opex) },
              { label: "Net Margin", value: fmtPct(ytdNetMargin), color: ytdNetMargin !== null && ytdNetMargin >= 0 ? "text-emerald-400" : "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/50 mb-1">{label}</p>
                <p className={`text-xl font-semibold ${color ?? "text-white"}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Monthly P&L table */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-white/10 text-white/50 uppercase tracking-wide">
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
                  <tr key={r.period_start} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 text-white/70 font-medium">{r.label}</td>
                    <td className="px-3 py-2 text-right text-white/80">{fmt(r.revenue_target)}</td>
                    <td className="px-3 py-2 text-right text-white/60">{fmt(r.cogs_target)}</td>
                    <td className="px-3 py-2 text-right text-white/80">{fmt(r.grossProfit)}</td>
                    <td className="px-3 py-2 text-right text-white/60">{fmtPct(r.grossMargin)}</td>
                    <td className="px-3 py-2 text-right text-white/60">{fmt(r.opex_target)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${r.net_income_target === null ? "text-white/40" : r.net_income_target >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fmt(r.net_income_target)}
                    </td>
                    <td className="px-3 py-2 text-right text-white/60">{fmtPct(r.netMargin)}</td>
                  </tr>
                ))}
                {/* YTD total row */}
                <tr className="border-t border-white/20 bg-white/5 font-semibold">
                  <td className="px-3 py-2.5 text-white/80">Annual Total</td>
                  <td className="px-3 py-2.5 text-right text-white">{fmt(ytd.revenue)}</td>
                  <td className="px-3 py-2.5 text-right text-white/70">{fmt(ytd.cogs)}</td>
                  <td className="px-3 py-2.5 text-right text-white">{fmt(ytdGrossProfit)}</td>
                  <td className="px-3 py-2.5 text-right text-white/70">{fmtPct(ytdGrossMargin)}</td>
                  <td className="px-3 py-2.5 text-right text-white/70">{fmt(ytd.opex)}</td>
                  <td className={`px-3 py-2.5 text-right ${ytd.net_income >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(ytd.net_income)}</td>
                  <td className="px-3 py-2.5 text-right text-white/70">{fmtPct(ytdNetMargin)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-white/30">
            Projected income statement · {data.year} · {data.months_with_budgets} months with targets
          </p>
        </>
      )}
    </div>
  );
}
