import { useMemo } from "react";
import { useDashboardData, useAllEntityFinancials } from "@/hooks/useApi";
import { ENTITY_SLUGS, ENTITY_CONFIG, type EntitySlug } from "@/lib/entities";
import { computeHealthScore } from "@/lib/briefing";
import { useEntitySelection } from "@/lib/entity-context";
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(Math.abs(n) / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(Math.abs(n) / 1_000).toFixed(0)}K`;
  return `$${Math.abs(n)}`;
}
function pct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; }

type MonthlyPoint = {
  label: string;
  revenue: number;
  net_income: number;
  gross_profit: number;
  opex: number;
  net_margin: number;
  gross_margin: number;
};

function summarize(series: MonthlyPoint[]) {
  const revenue = series.reduce((s, m) => s + m.revenue, 0);
  const net_income = series.reduce((s, m) => s + m.net_income, 0);
  return {
    revenue,
    net_income,
    net_margin: revenue > 0 ? (net_income / revenue) * 100 : 0,
  };
}

export default function HistoryPage() {
  const { selected } = useEntitySelection();
  const { data, source } = useDashboardData();
  const { data: allFins, source: finsSource } = useAllEntityFinancials();

  const slugs = useMemo(() => ENTITY_SLUGS.filter(s => selected.includes(s)), [selected]);

  const months = useMemo(() => {
    if (!allFins) return [] as string[];
    const set = new Set<string>();
    for (const slug of slugs) for (const p of allFins[slug].monthly_pl) set.add(p.month);
    return [...set].sort();
  }, [slugs, allFins]);

  const monthlySeries: MonthlyPoint[] = useMemo(() => {
    if (!allFins) return [];
    const byMonth: Partial<Record<EntitySlug, Map<string, { revenue: number; net_income: number; gross_profit: number; opex: number }>>> = {};
    for (const slug of slugs) {
      byMonth[slug] = new Map(allFins[slug].monthly_pl.map(p => [p.month, p]));
    }
    return months.map(label => {
      const revenue      = slugs.reduce((s, slug) => s + (byMonth[slug]?.get(label)?.revenue ?? 0), 0);
      const net_income   = slugs.reduce((s, slug) => s + (byMonth[slug]?.get(label)?.net_income ?? 0), 0);
      const gross_profit = slugs.reduce((s, slug) => s + (byMonth[slug]?.get(label)?.gross_profit ?? 0), 0);
      const opex         = slugs.reduce((s, slug) => s + (byMonth[slug]?.get(label)?.opex ?? 0), 0);
      const net_margin   = revenue > 0 ? (net_income / revenue) * 100 : 0;
      const gross_margin = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
      return { label, revenue, net_income, gross_profit, opex, net_margin, gross_margin };
    });
  }, [slugs, allFins, months]);

  const totalCash = useMemo(() => (data ? slugs.reduce((s, slug) => s + data.metrics[slug].cash_on_hand, 0) : 0), [slugs, data]);
  const totalAR   = useMemo(() => (data ? slugs.reduce((s, slug) => s + data.metrics[slug].open_ar, 0) : 0), [slugs, data]);

  // Real period slices derived from the live monthly series (no synthetic
  // prior-year approximations — only periods actually present in the data).
  const periods = useMemo(() => {
    const n = monthlySeries.length;
    const list: { id: string; label: string; sublabel: string; isCurrent: boolean; snap: ReturnType<typeof summarize> }[] = [];
    if (n === 0) return list;
    list.push({
      id: "ytd",
      label: "YTD",
      sublabel: `${monthlySeries[0].label} – ${monthlySeries[n - 1].label}`,
      isCurrent: true,
      snap: summarize(monthlySeries),
    });
    if (n >= 2) {
      const firstHalf = monthlySeries.slice(0, Math.ceil(n / 2));
      const secondHalf = monthlySeries.slice(Math.ceil(n / 2));
      if (firstHalf.length > 0) {
        list.push({
          id: "first-half",
          label: "First Half",
          sublabel: `${firstHalf[0].label} – ${firstHalf[firstHalf.length - 1].label}`,
          isCurrent: false,
          snap: summarize(firstHalf),
        });
      }
      if (secondHalf.length > 0) {
        list.push({
          id: "second-half",
          label: "Recent Half",
          sublabel: `${secondHalf[0].label} – ${secondHalf[secondHalf.length - 1].label}`,
          isCurrent: false,
          snap: summarize(secondHalf),
        });
      }
    }
    list.push({
      id: "latest",
      label: "Latest Month",
      sublabel: monthlySeries[n - 1].label,
      isCurrent: false,
      snap: summarize(monthlySeries.slice(n - 1)),
    });
    return list;
  }, [monthlySeries]);

  const healthScores = useMemo(() => {
    if (!data) return [];
    return slugs.map(slug => ({
      slug,
      cfg: ENTITY_CONFIG[slug],
      score: computeHealthScore(data.metrics[slug]),
    }));
  }, [slugs, data]);

  const moMChanges = useMemo(() => monthlySeries.slice(1).map((curr, i) => {
    const prev = monthlySeries[i];
    return {
      label: curr.label,
      prevLabel: prev.label,
      revChange:    prev.revenue > 0    ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : 0,
      niChange:     prev.net_income > 0 ? ((curr.net_income - prev.net_income) / prev.net_income) * 100 : 0,
      marginChange: curr.net_margin - prev.net_margin,
    };
  }), [monthlySeries]);

  const bestRevMonth  = [...monthlySeries].sort((a, b) => b.revenue - a.revenue)[0];
  const worstNetMonth = [...monthlySeries].sort((a, b) => a.net_income - b.net_income)[0];
  const maxRev        = Math.max(1, ...monthlySeries.map(m => m.revenue));
  const H = 80;
  const chartW = Math.max(monthlySeries.length, 1) * 100;

  if (!data || !allFins) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" || finsSource === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }

  if (slugs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-gray-500">No entities selected</p>
          <p className="text-[12px] text-gray-400 mt-1">Select at least one entity using the filter above.</p>
        </div>
      </div>
    );
  }

  const periodLabel = months.length > 0 ? `${months[0]} – ${months[months.length - 1]}` : "";

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h1 className="text-[14px] sm:text-[15px] font-bold text-gray-900">History / Time Machine</h1>
            <p className="text-[10px] sm:text-[11px] text-gray-400">{periodLabel ? `Live data · ${periodLabel}` : "Live data"}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

        {monthlySeries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-[13px] font-semibold text-gray-500">No monthly history available</p>
            <p className="text-[12px] text-gray-400 mt-1">The data pipeline has not produced monthly P&L data for the selected entities yet.</p>
          </div>
        ) : (
          <>
        {/* Period comparison cards */}
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Period Comparison</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {periods.map(period => {
              const snap = period.snap;
              const isYTD = period.isCurrent;
              const ytd = periods[0]?.snap;
              const revDiff = isYTD || !ytd ? null : ((ytd.revenue - snap.revenue) / Math.max(snap.revenue, 1)) * 100;
              return (
                <div key={period.id} className={`bg-white rounded-xl border p-3 sm:p-4 ${isYTD ? "border-emerald-300 ring-1 ring-emerald-200" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-2 gap-1">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-gray-900 truncate">{period.label}</p>
                      <p className="text-[10px] text-gray-400 truncate">{period.sublabel}</p>
                    </div>
                    {isYTD && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full flex-shrink-0">NOW</span>}
                  </div>
                  <div className="space-y-1.5 border-t border-gray-100 pt-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Revenue</span>
                      <span className="text-[11px] font-semibold text-gray-800">{fmt(snap.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Net Income</span>
                      <span className="text-[11px] font-semibold text-emerald-700">{fmt(snap.net_income)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Net Margin</span>
                      <span className="text-[11px] font-semibold text-gray-700">{snap.net_margin.toFixed(1)}%</span>
                    </div>
                    {isYTD && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Cash</span>
                        <span className="text-[11px] font-semibold text-gray-700">{fmt(totalCash)}</span>
                      </div>
                    )}
                    {isYTD && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Open AR</span>
                        <span className="text-[11px] font-semibold text-gray-700">{fmt(totalAR)}</span>
                      </div>
                    )}
                  </div>
                  {!isYTD && revDiff !== null && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1">
                      {revDiff > 0
                        ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                        : revDiff < 0
                        ? <TrendingDown className="w-3 h-3 text-red-500" />
                        : <Minus className="w-3 h-3 text-gray-400" />
                      }
                      <span className={`text-[9px] font-semibold ${revDiff > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        YTD vs {period.label}: {pct(revDiff)} rev
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue trend chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-[13px] font-semibold text-gray-900 mb-1">Portfolio Revenue Trend{periodLabel ? ` — ${periodLabel}` : ""}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
            <span className="text-[11px] text-gray-400">Best month: <span className="font-semibold text-gray-700">{bestRevMonth?.label} ({fmt(bestRevMonth?.revenue ?? 0)})</span></span>
            <span className="text-gray-200 hidden sm:block">|</span>
            <span className="text-[11px] text-gray-400">Lowest NI: <span className="font-semibold text-gray-700">{worstNetMonth?.label} ({fmt(worstNetMonth?.net_income ?? 0)})</span></span>
          </div>
          <svg viewBox={`0 0 ${chartW} ${H + 20}`} className="w-full overflow-visible" style={{ height: H + 20 }}>
            {[0.25, 0.5, 0.75, 1].map(r => (
              <line key={r} x1={0} x2={chartW} y1={H - r * H} y2={H - r * H} stroke="#F3F4F6" strokeWidth="1" />
            ))}
            {monthlySeries.map((m, i) => {
              const barW = 50;
              const x = i * 100 + 25;
              const barH = (m.revenue / maxRev) * H;
              return <rect key={`rev-${i}`} x={x} y={H - barH} width={barW} height={barH} rx={3} fill="#E5E7EB" />;
            })}
            {monthlySeries.map((m, i) => {
              const barW = 25;
              const x = i * 100 + 25;
              const niH = Math.max(0, (m.net_income / maxRev) * H);
              return <rect key={`ni-${i}`} x={x} y={H - niH} width={barW} height={niH} rx={3} fill="#10B981" />;
            })}
            {(() => {
              const pts = monthlySeries.map((m, i) => `${i * 100 + 50},${H - (m.net_margin / 50) * H}`).join(" ");
              return <polyline points={pts} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinejoin="round" />;
            })()}
            {monthlySeries.map((m, i) => (
              <text key={m.label} x={i * 100 + 50} y={H + 14} textAnchor="middle" fontSize="10" fill="#9CA3AF">{m.label}</text>
            ))}
          </svg>
          <div className="flex items-center gap-5 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-gray-200" /><span className="text-[10px] text-gray-500">Revenue</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-emerald-500" /><span className="text-[10px] text-gray-500">Net Income</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-violet-500" /><span className="text-[10px] text-gray-500">Net Margin %</span></div>
          </div>
        </div>

        {/* Month-over-month changes */}
        {moMChanges.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900">Month-over-Month Changes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Period</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Revenue Δ</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Net Income Δ</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Margin Δ (pp)</th>
                  </tr>
                </thead>
                <tbody>
                  {moMChanges.map(row => (
                    <tr key={row.label} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-[12px] text-gray-600">{row.prevLabel} → {row.label}</td>
                      <td className="px-4 py-2.5 text-right"><ChangeChip value={row.revChange} suffix="%" /></td>
                      <td className="px-4 py-2.5 text-right"><ChangeChip value={row.niChange} suffix="%" /></td>
                      <td className="px-4 py-2.5 text-right"><ChangeChip value={row.marginChange} suffix="pp" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Entity health scores (current, from live metrics) */}
        {healthScores.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900">Entity Health Score — Current</h3>
              <p className="text-[11px] text-gray-400">Penalty-based score computed from live metrics (100 = healthy). Monthly trend will be available once historical snapshots are stored.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Entity</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide bg-gray-50">Current Score</th>
                  </tr>
                </thead>
                <tbody>
                  {healthScores.map(({ slug, cfg, score }) => (
                    <tr key={slug} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                          <span className="text-[12px] font-medium text-gray-800">{cfg.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right bg-gray-50"><ScoreChip score={score} bold /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Monthly P&L summary table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Portfolio Monthly Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px]">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Metric</th>
                  {monthlySeries.map(m => <th key={m.label} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{m.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Revenue",      values: monthlySeries.map(m => m.revenue),      fmtFn: fmt,                                color: "text-gray-800" },
                  { label: "Gross Profit", values: monthlySeries.map(m => m.gross_profit), fmtFn: fmt,                                color: "text-gray-700" },
                  { label: "OpEx",         values: monthlySeries.map(m => m.opex),         fmtFn: fmt,                                color: "text-red-700" },
                  { label: "Net Income",   values: monthlySeries.map(m => m.net_income),   fmtFn: fmt,                                color: "text-emerald-700" },
                  { label: "Net Margin",   values: monthlySeries.map(m => m.net_margin),   fmtFn: (n: number) => `${n.toFixed(1)}%`, color: "text-violet-700" },
                ].map(row => (
                  <tr key={row.label} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-[12px] font-medium text-gray-600">{row.label}</td>
                    {row.values.map((v, i) => <td key={i} className={`px-3 py-2.5 text-right text-[12px] font-medium ${row.color}`}>{row.fmtFn(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ChangeChip({ value, suffix }: { value: number; suffix: string }) {
  const isPos = value > 0;
  const isNeg = value < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${isPos ? "text-emerald-600" : isNeg ? "text-red-600" : "text-gray-400"}`}>
      {isPos ? <TrendingUp className="w-3 h-3" /> : isNeg ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {value > 0 ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}

function ScoreChip({ score, bold }: { score: number; bold?: boolean }) {
  const color = score >= 80 ? "text-emerald-700 bg-emerald-50" : score >= 60 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${bold ? "font-black" : "font-semibold"} ${color}`}>
      {score}
    </span>
  );
}
