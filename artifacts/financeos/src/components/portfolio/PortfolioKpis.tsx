import Link from "@/lib/next-compat";
import type { PortfolioSummary, EntityMetrics, Anomaly, EntitySlug } from "@/lib/types";
import { ENTITY_CONFIG, ENTITY_SLUGS } from "@/lib/entities";

type Props = {
  portfolio: PortfolioSummary;
  metrics: Record<EntitySlug, EntityMetrics>;
  anomalies: Record<EntitySlug, Anomaly[]>;
};

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PortfolioKpis({ portfolio, metrics, anomalies }: Props) {
  return (
    <div className="space-y-6">

      {/* Portfolio-level summary strip */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label="Portfolio Revenue YTD"
          value={fmt(portfolio.portfolio_revenue_ytd)}
        />
        <SummaryCard
          label="Portfolio Net Income"
          value={fmt(portfolio.portfolio_net_income_ytd)}
          sub={`${pct(portfolio.portfolio_net_margin_pct)} net margin`}
        />
        <SummaryCard
          label="Portfolio Open AR"
          value={fmt(portfolio.portfolio_open_ar)}
        />
        <SummaryCard
          label="Portfolio Cash"
          value={fmt(portfolio.portfolio_cash_on_hand)}
        />
      </div>

      {/* Per-entity cards — 2 × 2 grid */}
      <div className="grid grid-cols-2 gap-4">
        {ENTITY_SLUGS.map((slug) => {
          const m      = metrics[slug];
          const config = ENTITY_CONFIG[slug];
          const alerts = anomalies[slug]?.length ?? 0;

          return (
            <Link key={slug} href={`/entity/${slug}`} className="group block">
              <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all">

                {/* Card header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="font-semibold text-gray-900 text-sm">{config.name}</span>
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                      {m.basis}
                    </span>
                  </div>
                  {alerts > 0 && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {alerts} alert{alerts !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* KPI grid — 3 columns */}
                <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                  <KpiCell label="Revenue YTD"  value={fmt(m.revenue_ytd)} />
                  <KpiCell label="Net Income"   value={fmt(m.net_income_ytd)} sub={pct(m.net_margin_pct)} />
                  <KpiCell label="Gross Margin" value={pct(m.gross_margin_pct)} />
                  <KpiCell label="Open AR"      value={fmt(m.open_ar)} warn={m.ar_overdue_pct > 15} />
                  <KpiCell label="DSO"          value={`${m.dso_days}d`} warn={m.dso_days > 60} />
                  <KpiCell label="Cash"         value={fmt(m.cash_on_hand)} />
                </div>

                <p className="text-[11px] text-gray-400 mt-3 group-hover:text-brand-teal transition-colors">
                  View entity detail →
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1 leading-none">{label}</p>
      <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function KpiCell({
  label, value, sub, warn,
}: {
  label: string; value: string; sub?: string; warn?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold leading-tight ${warn ? "text-amber-600" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
