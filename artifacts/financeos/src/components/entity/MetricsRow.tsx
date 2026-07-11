import type { EntityMetrics } from "@/lib/types";
import { formatCurrency, formatPercent, formatDays } from "@/lib/format";

type Props = { metrics: EntityMetrics };

export function MetricsRow({ metrics: m }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard label="Revenue YTD"  value={formatCurrency(m.revenue_ytd)} />
      <MetricCard label="Net Income"   value={formatCurrency(m.net_income_ytd)}
        sub={`${formatPercent(m.net_margin_pct)} net margin`} />
      <MetricCard label="Gross Margin" value={formatPercent(m.gross_margin_pct)} />
      <MetricCard label="Cash on Hand" value={formatCurrency(m.cash_on_hand)} />

      <MetricCard
        label="Open AR"
        value={formatCurrency(m.open_ar)}
        sub={`DSO: ${m.open_ar > 0 ? formatDays(m.dso_days) : "N/A"}`}
        warn={m.dso_days > 60 || m.ar_overdue_pct > 15}
        warnNote={m.ar_overdue_pct > 0 ? `${formatPercent(m.ar_overdue_pct)} overdue` : undefined}
      />
      <MetricCard
        label="Open AP"
        value={formatCurrency(m.open_ap)}
        sub={`DPO: ${m.open_ap > 0 ? formatDays(m.dpo_days) : "N/A"}`}
        warn={m.ap_overdue_pct > 5}
        warnNote={m.ap_overdue_pct > 0 ? `${formatPercent(m.ap_overdue_pct)} overdue` : undefined}
      />
      <MetricCard label="Total Assets"      value={formatCurrency(m.total_assets)} />
      <MetricCard label="Equity"            value={formatCurrency(m.total_equity)} />
    </div>
  );
}

function MetricCard({
  label, value, sub, warn, warnNote,
}: {
  label: string; value: string; sub?: string; warn?: boolean; warnNote?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 h-full ${warn ? "border-amber-200" : "border-gray-200"}`}>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className={`text-lg font-bold leading-tight ${warn ? "text-amber-600" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {warn && warnNote && (
        <p className="text-[10px] text-amber-500 mt-0.5">{warnNote}</p>
      )}
    </div>
  );
}
