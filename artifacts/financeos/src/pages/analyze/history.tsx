import { useMemo, useState } from "react";
import { useDashboardData, useAllEntityFinancials, useAllEntityHistory, useHealthSnapshots } from "@/hooks/useApi";
import { ENTITY_SLUGS, ENTITY_CONFIG, type EntitySlug } from "@/lib/entities";
import { useEntitySelection } from "@/lib/entity-context";
import type { MonthlyPL } from "@/lib/types";
import { Clock, TrendingUp, TrendingDown, Minus, ArrowLeftRight } from "lucide-react";
import { formatCurrency, formatPercent, isPartialMonth, PARTIAL_MONTH_NOTE } from "@/lib/format";

const fmt = (n: number) => formatCurrency(n);

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

/** Aggregate per-entity monthly P&L maps into a portfolio-level series. */
function buildSeries(
  slugs: EntitySlug[],
  byMonth: Partial<Record<EntitySlug, Map<string, MonthlyPL>>>,
  months: string[],
): MonthlyPoint[] {
  return months.map(label => {
    const revenue      = slugs.reduce((s, slug) => s + (byMonth[slug]?.get(label)?.revenue ?? 0), 0);
    const net_income   = slugs.reduce((s, slug) => s + (byMonth[slug]?.get(label)?.net_income ?? 0), 0);
    const gross_profit = slugs.reduce((s, slug) => s + (byMonth[slug]?.get(label)?.gross_profit ?? 0), 0);
    const opex         = slugs.reduce((s, slug) => s + (byMonth[slug]?.get(label)?.opex ?? 0), 0);
    const net_margin   = revenue > 0 ? (net_income / revenue) * 100 : 0;
    const gross_margin = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
    return { label, revenue, net_income, gross_profit, opex, net_margin, gross_margin };
  });
}

type PeriodDef = {
  id: string;
  label: string;
  sublabel: string;
  kind: "current" | "prior";
  snap: ReturnType<typeof summarize>;
  /** Cash at the end of the period, when a real balance is known (else null). */
  cash: number | null;
};

export default function HistoryPage() {
  const { selected } = useEntitySelection();
  const { data, source } = useDashboardData();
  const { data: allFins, source: finsSource } = useAllEntityFinancials();
  const { data: allHistory, source: historySource } = useAllEntityHistory();
  const { data: snapshots } = useHealthSnapshots();

  const slugs = useMemo(() => ENTITY_SLUGS.filter(s => selected.includes(s)), [selected]);

  const months = useMemo(() => {
    if (!allFins) return [] as string[];
    const set = new Set<string>();
    for (const slug of slugs) for (const p of allFins[slug].monthly_pl) set.add(p.month);
    return [...set].sort();
  }, [slugs, allFins]);

  const monthlySeries: MonthlyPoint[] = useMemo(() => {
    if (!allFins) return [];
    const byMonth: Partial<Record<EntitySlug, Map<string, MonthlyPL>>> = {};
    for (const slug of slugs) {
      byMonth[slug] = new Map(allFins[slug].monthly_pl.map(p => [p.month, p]));
    }
    return buildSeries(slugs, byMonth, months);
  }, [slugs, allFins, months]);

  const totalCash = useMemo(() => (data ? slugs.reduce((s, slug) => s + data.metrics[slug].cash_on_hand, 0) : 0), [slugs, data]);
  const totalAR   = useMemo(() => (data ? slugs.reduce((s, slug) => s + data.metrics[slug].open_ar, 0) : 0), [slugs, data]);

  // ── Real prior-year periods from the pipeline's archived exports ─────────────
  const priorYears = useMemo(() => {
    if (!allHistory) return [] as number[];
    const years = new Set<number>();
    for (const slug of slugs) {
      for (const py of allHistory[slug]?.prior_years ?? []) years.add(py.fiscal_year);
    }
    return [...years].sort((a, b) => a - b);
  }, [slugs, allHistory]);

  const priorData = useMemo(() => {
    const map = new Map<number, { series: MonthlyPoint[]; cashEoy: number | null }>();
    if (!allHistory) return map;
    for (const year of priorYears) {
      const monthSet = new Set<string>();
      const byMonth: Partial<Record<EntitySlug, Map<string, MonthlyPL>>> = {};
      let cashEoy: number | null = null;
      for (const slug of slugs) {
        const py = allHistory[slug]?.prior_years.find(p => p.fiscal_year === year);
        if (!py) continue;
        byMonth[slug] = new Map(py.monthly_pl.map(p => [p.month, p]));
        for (const p of py.monthly_pl) monthSet.add(p.month);
        if (py.balance_sheet) cashEoy = (cashEoy ?? 0) + py.balance_sheet.cash;
      }
      const yearMonths = [...monthSet].sort();
      map.set(year, { series: buildSeries(slugs, byMonth, yearMonths), cashEoy });
    }
    return map;
  }, [slugs, allHistory, priorYears]);

  // Every period offered here is real: prior-year periods come from the
  // pipeline's archived prior-year exports, current periods from live monthly
  // P&L. Cash is only attached where an actual end-of-period balance exists.
  const periodOptions: PeriodDef[] = useMemo(() => {
    const list: PeriodDef[] = [];
    const range = (s: MonthlyPoint[]) => (s.length > 0 ? `${s[0].label} – ${s[s.length - 1].label}` : "");
    const monthNum = (m: MonthlyPoint) => Number.parseInt(m.label.slice(5, 7), 10);

    for (const year of priorYears) {
      const entry = priorData.get(year);
      if (!entry || entry.series.length === 0) continue;
      const { series, cashEoy } = entry;
      const endsInDec = series[series.length - 1].label.endsWith("-12");
      list.push({ id: `fy-${year}`, label: `FY ${year}`, sublabel: range(series), kind: "prior", snap: summarize(series), cash: endsInDec ? cashEoy : null });
      const h1 = series.filter(m => monthNum(m) <= 6);
      const h2 = series.filter(m => monthNum(m) >= 7);
      if (h1.length > 0) list.push({ id: `h1-${year}`, label: `H1 ${year}`, sublabel: range(h1), kind: "prior", snap: summarize(h1), cash: null });
      if (h2.length > 0) list.push({ id: `h2-${year}`, label: `H2 ${year}`, sublabel: range(h2), kind: "prior", snap: summarize(h2), cash: h2[h2.length - 1].label.endsWith("-12") ? cashEoy : null });
      for (let q = 1; q <= 4; q++) {
        const qMonths = series.filter(m => Math.ceil(monthNum(m) / 3) === q);
        if (qMonths.length === 0) continue;
        list.push({ id: `q${q}-${year}`, label: `Q${q} ${year}`, sublabel: range(qMonths), kind: "prior", snap: summarize(qMonths), cash: q === 4 && qMonths[qMonths.length - 1].label.endsWith("-12") ? cashEoy : null });
      }
    }

    if (monthlySeries.length > 0) {
      const curYear = monthlySeries[0].label.slice(0, 4);
      const latest = monthlySeries[monthlySeries.length - 1];
      list.push({ id: "ytd", label: `YTD ${curYear}`, sublabel: range(monthlySeries), kind: "current", snap: summarize(monthlySeries), cash: totalCash });
      for (let q = 1; q <= 4; q++) {
        const qMonths = monthlySeries.filter(m => Math.ceil(monthNum(m) / 3) === q);
        if (qMonths.length === 0) continue;
        const includesLatest = qMonths[qMonths.length - 1].label === latest.label;
        list.push({ id: `q${q}-cur`, label: `Q${q} ${curYear}`, sublabel: range(qMonths), kind: "current", snap: summarize(qMonths), cash: includesLatest ? totalCash : null });
      }
      list.push({ id: "latest", label: `Latest Month`, sublabel: latest.label, kind: "current", snap: summarize([latest]), cash: totalCash });
    }
    return list;
  }, [priorYears, priorData, monthlySeries, totalCash]);

  const [periodAId, setPeriodAId] = useState<string | null>(null);
  const [periodBId, setPeriodBId] = useState<string | null>(null);

  const defaultAId = periodOptions.find(p => p.id === "ytd")?.id ?? periodOptions[0]?.id ?? null;
  const defaultBId =
    periodOptions.find(p => p.id.startsWith("fy-"))?.id ??
    periodOptions.find(p => p.id !== defaultAId)?.id ??
    defaultAId;
  const periodA = periodOptions.find(p => p.id === periodAId) ?? periodOptions.find(p => p.id === defaultAId) ?? null;
  const periodB = periodOptions.find(p => p.id === periodBId) ?? periodOptions.find(p => p.id === defaultBId) ?? null;

  // ── Health score trend from stored monthly snapshots ─────────────────────────
  const healthTrend = useMemo(() => {
    const monthSet = new Set<string>();
    if (snapshots) {
      for (const slug of slugs) for (const s of snapshots[slug] ?? []) monthSet.add(s.month);
    }
    const trendMonths = [...monthSet].sort();
    const rows = slugs.map(slug => ({
      slug,
      cfg: ENTITY_CONFIG[slug],
      byMonth: new Map((snapshots?.[slug] ?? []).map(s => [s.month, s.metrics.health_score])),
      current: data ? data.metrics[slug].health_score : null,
    }));
    return { trendMonths, rows };
  }, [slugs, snapshots, data]);

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
  const historyLoading = historySource === "loading";

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
        {/* Period comparison — pick two real periods */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900">Period Comparison</h3>
              <p className="text-[11px] text-gray-400">
                {priorYears.length > 0
                  ? "All periods are real: prior-year figures come from the pipeline's archived exports, current figures from live monthly P&L."
                  : historyLoading
                  ? "Loading prior-period archives…"
                  : "Prior-year archives are unavailable right now — only current-year periods can be compared."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PeriodSelect value={periodA?.id ?? ""} onChange={setPeriodAId} options={periodOptions} testId="select-period-a" />
              <ArrowLeftRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <PeriodSelect value={periodB?.id ?? ""} onChange={setPeriodBId} options={periodOptions} testId="select-period-b" />
            </div>
          </div>

          {periodA && periodB && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px]">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Metric</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide bg-violet-50/50">
                      {periodA.label}
                      <span className="block font-normal normal-case text-gray-400">{periodA.sublabel}</span>
                    </th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
                      {periodB.label}
                      <span className="block font-normal normal-case text-gray-400">{periodB.sublabel}</span>
                    </th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Δ ({periodA.label} vs {periodB.label})</th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Revenue" a={periodA.snap.revenue} b={periodB.snap.revenue} fmtFn={fmt} deltaMode="pct" testId="row-compare-revenue" />
                  <CompareRow label="Net Income" a={periodA.snap.net_income} b={periodB.snap.net_income} fmtFn={fmt} deltaMode="pct" testId="row-compare-net-income" />
                  <CompareRow label="Net Margin" a={periodA.snap.net_margin} b={periodB.snap.net_margin} fmtFn={(n) => formatPercent(n)} deltaMode="pp" testId="row-compare-margin" />
                  <CompareRow label="Cash (end of period)" a={periodA.cash} b={periodB.cash} fmtFn={fmt} deltaMode="pct" testId="row-compare-cash" />
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-[10px] text-gray-400">Open AR now: <span className="font-semibold text-gray-600">{fmt(totalAR)}</span></span>
            <span className="text-[10px] text-gray-400">Cash now: <span className="font-semibold text-gray-600">{fmt(totalCash)}</span></span>
            <span className="text-[10px] text-gray-400">Cash shows "—" for periods without an archived end-of-period balance sheet.</span>
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
              <text key={m.label} x={i * 100 + 50} y={H + 14} textAnchor="middle" fontSize="10" fill={isPartialMonth(m.label) ? "#F59E0B" : "#9CA3AF"}>
                {m.label}{isPartialMonth(m.label) ? " *" : ""}
              </text>
            ))}
          </svg>
          {monthlySeries.some(m => isPartialMonth(m.label)) && (
            <p className="text-[10px] text-gray-400 mt-1"><span className="text-amber-500">*</span> {PARTIAL_MONTH_NOTE}</p>
          )}
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

        {/* Entity health scores — monthly trend from stored snapshots */}
        {healthTrend.rows.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900">Entity Health Score — Monthly Trend</h3>
              <p className="text-[11px] text-gray-400">
                Penalty-based score (100 = healthy), recomputed from the metrics snapshot stored for each month.
                {healthTrend.trendMonths.length <= 1 ? " Snapshots accumulate monthly as the pipeline runs — the trend fills in over time." : ""}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Entity</th>
                    {healthTrend.trendMonths.map(m => (
                      <th key={m} className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{m}</th>
                    ))}
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide bg-gray-50">Current</th>
                  </tr>
                </thead>
                <tbody>
                  {healthTrend.rows.map(({ slug, cfg, byMonth, current }) => (
                    <tr key={slug} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                          <span className="text-[12px] font-medium text-gray-800">{cfg.name}</span>
                        </div>
                      </td>
                      {healthTrend.trendMonths.map(m => {
                        const s = byMonth.get(m);
                        return (
                          <td key={m} className="px-4 py-2.5 text-right">
                            {s !== undefined ? <ScoreChip score={s} /> : <span className="text-[11px] text-gray-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-right bg-gray-50">
                        {current !== null ? <ScoreChip score={current} bold /> : <span className="text-[11px] text-gray-300">—</span>}
                      </td>
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
                  {monthlySeries.map(m => (
                    <th key={m.label} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      {m.label}
                      {isPartialMonth(m.label) && <span className="text-amber-500" title={PARTIAL_MONTH_NOTE}> *</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Revenue",      values: monthlySeries.map(m => m.revenue),      fmtFn: fmt,                                color: "text-gray-800" },
                  { label: "Gross Profit", values: monthlySeries.map(m => m.gross_profit), fmtFn: fmt,                                color: "text-gray-700" },
                  { label: "OpEx",         values: monthlySeries.map(m => m.opex),         fmtFn: fmt,                                color: "text-red-700" },
                  { label: "Net Income",   values: monthlySeries.map(m => m.net_income),   fmtFn: fmt,                                color: "text-emerald-700" },
                  { label: "Net Margin",   values: monthlySeries.map(m => m.net_margin),   fmtFn: (n: number) => formatPercent(n), color: "text-violet-700" },
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

function PeriodSelect({ value, onChange, options, testId }: {
  value: string;
  onChange: (id: string) => void;
  options: PeriodDef[];
  testId: string;
}) {
  const prior = options.filter(o => o.kind === "prior");
  const current = options.filter(o => o.kind === "current");
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      data-testid={testId}
      className="text-[12px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300"
    >
      {current.length > 0 && (
        <optgroup label="Current year">
          {current.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </optgroup>
      )}
      {prior.length > 0 && (
        <optgroup label="Prior years (archived)">
          {prior.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </optgroup>
      )}
    </select>
  );
}

function CompareRow({ label, a, b, fmtFn, deltaMode, testId }: {
  label: string;
  a: number | null;
  b: number | null;
  fmtFn: (n: number) => string;
  deltaMode: "pct" | "pp";
  testId: string;
}) {
  const hasBoth = a !== null && b !== null;
  let delta: number | null = null;
  let suffix = "%";
  if (hasBoth) {
    if (deltaMode === "pp") {
      delta = a - b;
      suffix = "pp";
    } else if (b !== 0) {
      delta = ((a - b) / Math.abs(b)) * 100;
    }
  }
  return (
    <tr className="border-t border-gray-50 hover:bg-gray-50 transition-colors" data-testid={testId}>
      <td className="px-4 py-2.5 text-[12px] font-medium text-gray-600">{label}</td>
      <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-gray-800 bg-violet-50/50">
        {a !== null ? fmtFn(a) : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-2.5 text-right text-[12px] font-medium text-gray-600">
        {b !== null ? fmtFn(b) : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-2.5 text-right">
        {delta !== null ? <ChangeChip value={delta} suffix={suffix} /> : <span className="text-[11px] text-gray-300">—</span>}
      </td>
    </tr>
  );
}

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
