import { getMockData, getFinancials } from "@/lib/mock";
import { ENTITY_SLUGS, ENTITY_CONFIG, type EntitySlug } from "@/lib/types";
import { computeHealthScore } from "@/lib/briefing";
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const MONTH_LABELS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(Math.abs(n) / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(Math.abs(n) / 1_000).toFixed(0)}K`;
  return `$${Math.abs(n)}`;
}
function pct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; }

// Derive approximate monthly DSO from rolling AR and revenue approximation
function monthlyMetricSeries(fins: Record<EntitySlug, ReturnType<typeof getFinancials>>, data: ReturnType<typeof getMockData>) {
  return MONTHS.map((label, i) => {
    const revenue      = ENTITY_SLUGS.reduce((s, slug) => s + fins[slug].monthly_pl[i].revenue, 0);
    const net_income   = ENTITY_SLUGS.reduce((s, slug) => s + fins[slug].monthly_pl[i].net_income, 0);
    const gross_profit = ENTITY_SLUGS.reduce((s, slug) => s + fins[slug].monthly_pl[i].gross_profit, 0);
    const opex         = ENTITY_SLUGS.reduce((s, slug) => s + fins[slug].monthly_pl[i].opex, 0);
    const net_margin   = revenue > 0 ? (net_income / revenue) * 100 : 0;
    const gross_margin = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
    return { label, revenue, net_income, gross_profit, opex, net_margin, gross_margin };
  });
}

// Mock historical snapshots: derive from the monthly data with slight variation for prior months
const SNAPSHOT_PERIODS = [
  { id: "ytd-2026",    label: "YTD 2026",    sublabel: "Jan–Jun 2026",  isCurrent: true },
  { id: "q1-2026",     label: "Q1 2026",     sublabel: "Jan–Mar 2026",  isCurrent: false },
  { id: "fy-2025",     label: "FY 2025",     sublabel: "Full year 2025", isCurrent: false },
  { id: "q3-2025",     label: "Q3 2025",     sublabel: "Jul–Sep 2025",  isCurrent: false },
];

// Approximated historical comparisons (mock — no real historical data)
const MOCK_HISTORY = {
  "ytd-2026": { revenue: 1243200, net_income: 359500, net_margin: 28.9, cash: 739800, ar: 218600, note: "Current period" },
  "q1-2026":  { revenue: 550000,  net_income: 157200, net_margin: 28.6, cash: 690000, ar: 201000, note: "Q1 snapshot" },
  "fy-2025":  { revenue: 2180000, net_income: 592000, net_margin: 27.2, cash: 612000, ar: 195000, note: "Prior full year" },
  "q3-2025":  { revenue: 510000,  net_income: 128000, net_margin: 25.1, cash: 580000, ar: 188000, note: "Q3 2025 snapshot" },
};

// Monthly health score per entity (derived with slight variation)
function buildHealthHistory(data: ReturnType<typeof getMockData>) {
  return ENTITY_SLUGS.map((slug) => {
    const baseScore = computeHealthScore(data.metrics[slug]);
    const cfg = ENTITY_CONFIG[slug];
    // Simulate slight monthly variation: score improves toward current
    const scores = MONTHS.map((_, i) => {
      const delta = (i - 5) * 2; // earlier months slightly lower
      return Math.max(30, Math.min(100, baseScore + delta));
    });
    return { slug, cfg, scores, current: baseScore };
  });
}

export default function HistoryPage() {
  const data = getMockData();
  const fins = Object.fromEntries(ENTITY_SLUGS.map((s) => [s, getFinancials(s)])) as Record<EntitySlug, ReturnType<typeof getFinancials>>;

  const monthlySeries = monthlyMetricSeries(fins, data);
  const healthHistory = buildHealthHistory(data);

  // Month-over-month changes
  const moMChanges = MONTHS.slice(1).map((label, i) => {
    const curr = monthlySeries[i + 1];
    const prev = monthlySeries[i];
    return {
      label,
      revChange:    prev.revenue > 0    ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : 0,
      niChange:     prev.net_income > 0 ? ((curr.net_income - prev.net_income) / prev.net_income) * 100 : 0,
      marginChange: curr.net_margin - prev.net_margin,
    };
  });

  // Best and worst months
  const bestRevMonth  = [...monthlySeries].sort((a, b) => b.revenue - a.revenue)[0];
  const worstNetMonth = [...monthlySeries].sort((a, b) => a.net_income - b.net_income)[0];

  const maxRev = Math.max(...monthlySeries.map((m) => m.revenue));
  const H = 80;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
            <Clock className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">History / Time Machine</h1>
            <p className="text-[11px] text-gray-400">Mock data · YTD 2026 + approximated prior periods</p>
          </div>
        </div>
        <span className="text-[10px] px-2.5 py-1 bg-violet-50 text-violet-700 rounded-full font-semibold">Phase 1 — Mock</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Period comparison cards */}
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Period Comparison</p>
          <div className="grid grid-cols-4 gap-3">
            {SNAPSHOT_PERIODS.map((period) => {
              const snap = MOCK_HISTORY[period.id as keyof typeof MOCK_HISTORY];
              const isYTD = period.isCurrent;
              const ytd = MOCK_HISTORY["ytd-2026"];
              const revDiff = isYTD ? null : ((ytd.revenue - snap.revenue) / snap.revenue) * 100;
              return (
                <div key={period.id} className={`bg-white rounded-xl border p-4 ${isYTD ? "border-emerald-300 ring-1 ring-emerald-200" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[12px] font-bold text-gray-900">{period.label}</p>
                      <p className="text-[10px] text-gray-400">{period.sublabel}</p>
                    </div>
                    {isYTD && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">CURRENT</span>}
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
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Cash</span>
                      <span className="text-[11px] font-semibold text-gray-700">{fmt(snap.cash)}</span>
                    </div>
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

        {/* Monthly revenue + net income trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-[13px] font-semibold text-gray-900 mb-1">Portfolio Revenue Trend — Jan–Jun 2026</h3>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] text-gray-400">Best month: <span className="font-semibold text-gray-700">{bestRevMonth.label} ({fmt(bestRevMonth.revenue)})</span></span>
            <span className="text-gray-200">|</span>
            <span className="text-[11px] text-gray-400">Lowest NI: <span className="font-semibold text-gray-700">{worstNetMonth.label} ({fmt(worstNetMonth.net_income)})</span></span>
          </div>
          <svg viewBox={`0 0 600 ${H + 20}`} className="w-full overflow-visible" style={{ height: H + 20 }}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((r) => (
              <line key={r} x1={0} x2={600} y1={H - r * H} y2={H - r * H} stroke="#F3F4F6" strokeWidth="1" />
            ))}
            {/* Revenue bars */}
            {monthlySeries.map((m, i) => {
              const barW = 50;
              const x = i * 100 + 25;
              const barH = (m.revenue / maxRev) * H;
              return (
                <rect key={`rev-${i}`} x={x} y={H - barH} width={barW} height={barH} rx={3} fill="#E5E7EB" />
              );
            })}
            {/* Net income bars */}
            {monthlySeries.map((m, i) => {
              const barW = 25;
              const x = i * 100 + 25;
              const niH = (m.net_income / maxRev) * H;
              return (
                <rect key={`ni-${i}`} x={x} y={H - niH} width={barW} height={niH} rx={3} fill="#10B981" />
              );
            })}
            {/* Net margin line */}
            {(() => {
              const pts = monthlySeries.map((m, i) => {
                const x = i * 100 + 50;
                const y = H - (m.net_margin / 50) * H;
                return `${x},${y}`;
              }).join(" ");
              return <polyline points={pts} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinejoin="round" />;
            })()}
            {/* Month labels */}
            {MONTHS.map((label, i) => (
              <text key={label} x={i * 100 + 50} y={H + 14} textAnchor="middle" fontSize="10" fill="#9CA3AF">{label}</text>
            ))}
          </svg>
          <div className="flex items-center gap-5 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-gray-200" /><span className="text-[10px] text-gray-500">Revenue</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-emerald-500" /><span className="text-[10px] text-gray-500">Net Income</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-violet-500" /><span className="text-[10px] text-gray-500">Net Margin %</span></div>
          </div>
        </div>

        {/* Month-over-month changes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Month-over-Month Changes</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Period</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Revenue Δ</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Net Income Δ</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Margin Δ (pp)</th>
              </tr>
            </thead>
            <tbody>
              {moMChanges.map((row, i) => (
                <tr key={row.label} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-[12px] text-gray-600">{MONTHS[i]} → {row.label}</td>
                  <td className="px-4 py-2.5 text-right">
                    <ChangeChip value={row.revChange} suffix="%" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ChangeChip value={row.niChange} suffix="%" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ChangeChip value={row.marginChange} suffix="pp" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Entity health score history */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Entity Health Score — Monthly Trend</h3>
            <p className="text-[11px] text-gray-400">Penalty-based score (100 = healthy)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-36">Entity</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{m}</th>
                  ))}
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide bg-gray-50">Current</th>
                </tr>
              </thead>
              <tbody>
                {healthHistory.map(({ slug, cfg, scores, current }) => (
                  <tr key={slug} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                      <span className="text-[12px] font-medium text-gray-800">{cfg.name}</span>
                    </td>
                    {scores.map((score, i) => (
                      <td key={i} className="px-3 py-2.5 text-right">
                        <ScoreChip score={score} />
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right bg-gray-50">
                      <ScoreChip score={current} bold />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly P&L summary table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Portfolio Monthly Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Metric</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Revenue",      values: monthlySeries.map((m) => m.revenue),      fmt: fmt, color: "text-gray-800" },
                  { label: "Gross Profit", values: monthlySeries.map((m) => m.gross_profit), fmt: fmt, color: "text-gray-700" },
                  { label: "OpEx",         values: monthlySeries.map((m) => m.opex),         fmt: fmt, color: "text-red-700" },
                  { label: "Net Income",   values: monthlySeries.map((m) => m.net_income),   fmt: fmt, color: "text-emerald-700" },
                  { label: "Net Margin",   values: monthlySeries.map((m) => m.net_margin),   fmt: (n: number) => `${n.toFixed(1)}%`, color: "text-violet-700" },
                ].map((row) => (
                  <tr key={row.label} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-[12px] font-medium text-gray-600">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className={`px-3 py-2.5 text-right text-[12px] font-medium ${row.color}`}>{row.fmt(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Phase 2 note */}
        <div className="flex items-start gap-2 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl">
          <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-[9px] font-bold">i</span>
          </div>
          <p className="text-[11px] text-violet-700">
            <span className="font-semibold">Phase 2:</span> Time Machine will display real historical snapshots from Google Shared Drive data pipeline runs,
            enabling side-by-side comparison of any two periods with full drill-down to transaction level.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
