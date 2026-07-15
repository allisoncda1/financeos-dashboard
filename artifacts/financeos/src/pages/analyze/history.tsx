import { useMemo } from "react";
import { useHistory } from "@/hooks/useApi";
import { ENTITY_SLUGS, ENTITY_CONFIG, type EntitySlug } from "@/lib/entities";
import { useEntitySelection } from "@/lib/entity-context";
import type { HistoryMonthlyPoint } from "@/lib/types";
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, formatPercent, isPartialMonth, PARTIAL_MONTH_NOTE } from "@/lib/format";

const fmt = (n: number | null) => formatCurrency(n);

export default function HistoryPage() {
  const { selected } = useEntitySelection();
  const slugs = useMemo(() => ENTITY_SLUGS.filter(s => selected.includes(s)), [selected]);
  const { data: history, source } = useHistory(slugs);

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

  if (!history) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400" data-testid="history-status">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }

  const { monthly, changes, snapshots, status } = history;
  const periodLabel =
    history.period_start && history.period_end
      ? history.period_start === history.period_end
        ? history.period_start
        : `${history.period_start} – ${history.period_end}`
      : "";

  // Presentation-only derivations (chart scaling / best-month labels). These
  // read the server-computed values; they perform NO financial aggregation or
  // month-over-month math (all of that comes from the API `changes` array).
  const maxRev = Math.max(1, ...monthly.map(m => m.revenue ?? 0));
  const bestRevMonth = monthly.reduce<HistoryMonthlyPoint | null>(
    (best, m) => ((m.revenue ?? -Infinity) > (best?.revenue ?? -Infinity) ? m : best),
    null,
  );
  const worstNetMonth = monthly.reduce<HistoryMonthlyPoint | null>(
    (worst, m) => ((m.net_income ?? Infinity) < (worst?.net_income ?? Infinity) ? m : worst),
    null,
  );
  const H = 80;
  const chartW = Math.max(monthly.length, 1) * 100;

  // Health-score trend (server-persisted). Straight passthrough of the
  // persisted portfolio health series — no math.
  const healthByEntity = summarizeHealth(history);

  const dataSourceLabel =
    source === "db" ? "Neon (FinanceOS Core)"
    : source === "live" ? "Live pipeline"
    : source === "cache" ? "Cached"
    : source === "mock" ? "Sample data"
    : "Unavailable";

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h1 className="text-[14px] sm:text-[15px] font-bold text-gray-900">History / Time Machine</h1>
            <p className="text-[10px] sm:text-[11px] text-gray-400" data-testid="history-source">
              {dataSourceLabel}{periodLabel ? ` · ${periodLabel}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

        {status === "partial" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5" data-testid="history-partial">
            <p className="text-[12px] text-amber-800">
              Partial history: only some selected entities have monthly data published. Totals cover the entities that do.
            </p>
          </div>
        )}

        {monthly.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center" data-testid="history-unavailable">
            <p className="text-[13px] font-semibold text-gray-500">No monthly history available</p>
            <p className="text-[12px] text-gray-400 mt-1">
              FinanceOS Core has not published monthly financial periods for the selected entities yet.
            </p>
          </div>
        ) : (
          <>
        {/* Revenue trend chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-[13px] font-semibold text-gray-900 mb-1">Portfolio Revenue Trend{periodLabel ? ` — ${periodLabel}` : ""}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
            <span className="text-[11px] text-gray-400">Best month: <span className="font-semibold text-gray-700">{bestRevMonth?.period} ({fmt(bestRevMonth?.revenue ?? null)})</span></span>
            <span className="text-gray-200 hidden sm:block">|</span>
            <span className="text-[11px] text-gray-400">Lowest NI: <span className="font-semibold text-gray-700">{worstNetMonth?.period} ({fmt(worstNetMonth?.net_income ?? null)})</span></span>
          </div>
          <svg viewBox={`0 0 ${chartW} ${H + 20}`} className="w-full overflow-visible" style={{ height: H + 20 }}>
            {[0.25, 0.5, 0.75, 1].map(r => (
              <line key={r} x1={0} x2={chartW} y1={H - r * H} y2={H - r * H} stroke="#F3F4F6" strokeWidth="1" />
            ))}
            {monthly.map((m, i) => {
              const x = i * 100 + 25;
              const barH = ((m.revenue ?? 0) / maxRev) * H;
              return <rect key={`rev-${i}`} x={x} y={H - barH} width={50} height={barH} rx={3} fill="#E5E7EB" />;
            })}
            {monthly.map((m, i) => {
              const x = i * 100 + 25;
              const niH = Math.max(0, ((m.net_income ?? 0) / maxRev) * H);
              return <rect key={`ni-${i}`} x={x} y={H - niH} width={25} height={niH} rx={3} fill="#10B981" />;
            })}
            {monthly.map((m, i) => (
              <text key={m.period} x={i * 100 + 50} y={H + 14} textAnchor="middle" fontSize="10" fill={isPartialMonth(m.period) ? "#F59E0B" : "#9CA3AF"}>
                {m.period}{isPartialMonth(m.period) ? " *" : ""}
              </text>
            ))}
          </svg>
          {monthly.some(m => isPartialMonth(m.period)) && (
            <p className="text-[10px] text-gray-400 mt-1"><span className="text-amber-500">*</span> {PARTIAL_MONTH_NOTE}</p>
          )}
          <div className="flex items-center gap-5 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-gray-200" /><span className="text-[10px] text-gray-500">Revenue</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-emerald-500" /><span className="text-[10px] text-gray-500">Net Income</span></div>
          </div>
        </div>

        {/* Month-over-month changes — rendered directly from API `changes` */}
        {changes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900">Month-over-Month Changes</h3>
              <p className="text-[11px] text-gray-400">Dollar and percentage changes computed server-side from published monthly periods.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px]">
                <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Period</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Revenue Δ</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Revenue Δ%</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Net Income Δ</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Net Income Δ%</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map(row => (
                    <tr key={row.period} className="border-t border-gray-50 hover:bg-gray-50 transition-colors" data-testid={`mom-${row.period}`}>
                      <td className="px-4 py-2.5 text-[12px] text-gray-600">{row.period}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] font-medium text-gray-700">{row.revenue_change !== null ? fmt(row.revenue_change) : <Dash />}</td>
                      <td className="px-4 py-2.5 text-right"><PctChip value={row.revenue_change_pct} /></td>
                      <td className="px-4 py-2.5 text-right text-[12px] font-medium text-gray-700">{row.net_income_change !== null ? fmt(row.net_income_change) : <Dash />}</td>
                      <td className="px-4 py-2.5 text-right"><PctChip value={row.net_income_change_pct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Entity health scores — server-persisted monthly trend */}
        {healthByEntity.available ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900">Health Score — Monthly Trend</h3>
              <p className="text-[11px] text-gray-400">Portfolio health score per month, from the metrics snapshot the pipeline archived each month.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Metric</th>
                    {healthByEntity.periods.map(p => (
                      <th key={p} className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-50">
                    <td className="px-4 py-2.5 text-[12px] font-medium text-gray-600">Portfolio Health</td>
                    {healthByEntity.periods.map(p => {
                      const score = healthByEntity.scoreByPeriod.get(p) ?? null;
                      return (
                        <td key={p} className="px-4 py-2.5 text-right">
                          {score !== null ? <ScoreChip score={score} /> : <Dash />}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3" data-testid="health-unavailable">
            <h3 className="text-[13px] font-semibold text-gray-900">Health Score — Monthly Trend</h3>
            <p className="text-[12px] text-gray-400 mt-1">Historical Health Score not yet available.</p>
          </div>
        )}

        {/* Portfolio monthly summary */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Portfolio Monthly Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px]">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Metric</th>
                  {monthly.map(m => (
                    <th key={m.period} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      {m.period}
                      {isPartialMonth(m.period) && <span className="text-amber-500" title={PARTIAL_MONTH_NOTE}> *</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Revenue",    pick: (m: HistoryMonthlyPoint) => m.revenue,    color: "text-gray-800" },
                  { label: "Net Income", pick: (m: HistoryMonthlyPoint) => m.net_income, color: "text-emerald-700" },
                ].map(row => (
                  <tr key={row.label} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-[12px] font-medium text-gray-600">{row.label}</td>
                    {monthly.map(m => {
                      const v = row.pick(m);
                      return <td key={m.period} className={`px-3 py-2.5 text-right text-[12px] font-medium ${row.color}`}>{v !== null ? fmt(v) : <Dash />}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Entity-period snapshot rows */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Entity-Period Snapshots</h3>
            <p className="text-[11px] text-gray-400">One row per entity per month, straight from published financial periods.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Entity</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Period</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Revenue</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Net Income</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map(row => (
                  <tr key={`${row.slug}-${row.period}`} className="border-t border-gray-50 hover:bg-gray-50 transition-colors" data-testid={`snapshot-${row.slug}-${row.period}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entityColor(row.slug) }} />
                        <span className="text-[12px] font-medium text-gray-800">{row.entity}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-600">{row.period}</td>
                    <td className="px-4 py-2.5 text-right text-[12px] font-medium text-gray-700">{row.revenue !== null ? fmt(row.revenue) : <Dash />}</td>
                    <td className="px-4 py-2.5 text-right text-[12px] font-medium text-emerald-700">{row.net_income !== null ? fmt(row.net_income) : <Dash />}</td>
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

/** Resolve a stable brand colour for an entity slug (falls back to gray). */
function entityColor(slug: string): string {
  const cfg = ENTITY_CONFIG[slug as EntitySlug];
  return cfg?.color ?? "#9CA3AF";
}

/** Reshape the server-provided health_score_history into a period-indexed map.
 * No math — a straight passthrough of the persisted portfolio health series. */
function summarizeHealth(
  history: { health_score_available: boolean; health_score_history: { period: string; score: number | null }[] | null },
) {
  if (!history.health_score_available || !history.health_score_history) {
    return { available: false as const, periods: [] as string[], scoreByPeriod: new Map<string, number | null>() };
  }
  const periods = history.health_score_history.map(p => p.period);
  const scoreByPeriod = new Map(history.health_score_history.map(p => [p.period, p.score]));
  return { available: true as const, periods, scoreByPeriod };
}

function Dash() {
  return <span className="text-[11px] text-gray-300">—</span>;
}

function PctChip({ value }: { value: number | null }) {
  if (value === null) return <Dash />;
  const isPos = value > 0;
  const isNeg = value < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${isPos ? "text-emerald-600" : isNeg ? "text-red-600" : "text-gray-400"}`}>
      {isPos ? <TrendingUp className="w-3 h-3" /> : isNeg ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {formatPercent(value)}
    </span>
  );
}

function ScoreChip({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-700 bg-emerald-50" : score >= 60 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}>{score}</span>
  );
}
