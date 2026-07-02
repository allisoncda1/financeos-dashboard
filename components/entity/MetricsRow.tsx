import type { EntityMetrics } from "@/lib/types";

type Props = { metrics: EntityMetrics };

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export function MetricsRow({ metrics: m }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard label="Revenue YTD"  value={fmt(m.revenue_ytd)} />
      <MetricCard label="Net Income"   value={fmt(m.net_income_ytd)}
        sub={`${m.net_margin_pct.toFixed(1)}% net margin`} />
      <MetricCard label="Gross Margin" value={`${m.gross_margin_pct.toFixed(1)}%`} />
      <MetricCard label="Cash on Hand" value={fmt(m.cash_on_hand)} />

      <MetricCard
        label="Open AR"
        value={fmt(m.open_ar)}
        sub={`DSO: ${m.dso_days}d`}
        warn={m.dso_days > 60 || m.ar_overdue_pct > 15}
        warnNote={m.ar_overdue_pct > 0 ? `${m.ar_overdue_pct.toFixed(1)}% overdue` : undefined}
      />
      <MetricCard
        label="Open AP"
        value={fmt(m.open_ap)}
        sub={`DPO: ${m.dpo_days}d`}
        warn={m.ap_overdue_pct > 5}
        warnNote={m.ap_overdue_pct > 0 ? `${m.ap_overdue_pct.toFixed(1)}% overdue` : undefined}
      />
      <MetricCard label="Total Assets"      value={fmt(m.total_assets)} />
      <MetricCard label="Equity"            value={fmt(m.total_equity)} />
    </div>
  );
}

function MetricCard({
  label, value, sub, warn, warnNote,
}: {
  label: string; value: string; sub?: string; warn?: boolean; warnNote?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${warn ? "border-amber-200" : "border-gray-200"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
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
