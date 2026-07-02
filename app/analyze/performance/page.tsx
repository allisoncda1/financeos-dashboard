import { getMockData, getFinancials } from "@/lib/mock";
import { ENTITY_SLUGS, ENTITY_CONFIG, type EntitySlug } from "@/lib/types";
import { computeHealthScore } from "@/lib/briefing";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function pct(n: number) { return `${n.toFixed(1)}%`; }

// Inline SVG sparkline
function Spark({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80, H = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Bar chart for entity comparison
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
      </div>
      <span className="text-[11px] font-semibold text-gray-800 w-14 text-right">{fmt(value)}</span>
    </div>
  );
}

export default function PerformancePage() {
  const data = getMockData();
  const fins = Object.fromEntries(ENTITY_SLUGS.map((s) => [s, getFinancials(s)])) as Record<EntitySlug, ReturnType<typeof getFinancials>>;

  const entities = ENTITY_SLUGS.map((slug) => {
    const m = data.metrics[slug];
    const cfg = ENTITY_CONFIG[slug];
    const fin = fins[slug];
    const health = computeHealthScore(m);
    const monthlyRevenue = fin.monthly_pl.map((p) => p.revenue);
    const monthlyNet     = fin.monthly_pl.map((p) => p.net_income);
    const revTrend = monthlyRevenue[5] - monthlyRevenue[0];
    return { slug, m, cfg, health, monthlyRevenue, monthlyNet, revTrend };
  });

  const maxRev    = Math.max(...entities.map((e) => e.m.revenue_ytd));
  const maxNet    = Math.max(...entities.map((e) => e.m.net_income_ytd));
  const maxAssets = Math.max(...entities.map((e) => e.m.total_assets));
  const maxCash   = Math.max(...entities.map((e) => e.m.cash_on_hand));

  // Portfolio monthly totals for combined chart
  const portfolioMonthly = MONTHS.map((_, i) => ({
    label: MONTHS[i],
    revenue:    ENTITY_SLUGS.reduce((s, slug) => s + fins[slug].monthly_pl[i].revenue, 0),
    net_income: ENTITY_SLUGS.reduce((s, slug) => s + fins[slug].monthly_pl[i].net_income, 0),
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Entity Performance</h1>
            <p className="text-[11px] text-gray-400">YTD comparison · Jan–Jun 2026 · mock data</p>
          </div>
        </div>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{entities.length} entities</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Scorecards row */}
        <div className="grid grid-cols-4 gap-3">
          {entities.map(({ slug, m, cfg, health, monthlyRevenue, revTrend }) => (
            <div key={slug} className="bg-white rounded-xl border border-gray-200 p-4">
              {/* Entity dot + name */}
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                <span className="text-[12px] font-bold text-gray-900 truncate">{cfg.name}</span>
              </div>
              {/* Health gauge */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] text-gray-400">Health Score</p>
                  <p className="text-[22px] font-black" style={{ color: health >= 80 ? "#10B981" : health >= 60 ? "#F59E0B" : "#EF4444" }}>
                    {health}
                  </p>
                </div>
                <Spark values={monthlyRevenue} color={cfg.color} />
              </div>
              <div className="space-y-1.5 border-t border-gray-100 pt-3">
                <KvRow label="Revenue YTD" value={fmt(m.revenue_ytd)} />
                <KvRow label="Net Income"  value={fmt(m.net_income_ytd)} />
                <KvRow label="Net Margin"  value={pct(m.net_margin_pct)} />
                <KvRow label="DSO"         value={`${m.dso_days}d`} />
              </div>
              <div className="mt-2 flex items-center gap-1">
                {revTrend > 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                  : revTrend < 0
                  ? <TrendingDown className="w-3 h-3 text-red-500" />
                  : <Minus className="w-3 h-3 text-gray-400" />
                }
                <span className={`text-[10px] font-medium ${revTrend > 0 ? "text-emerald-600" : revTrend < 0 ? "text-red-600" : "text-gray-400"}`}>
                  {revTrend > 0 ? "+" : ""}{fmt(revTrend)} rev Jan→Jun
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Side-by-side bar comparisons */}
        <div className="grid grid-cols-2 gap-4">

          {/* Revenue comparison */}
          <CompareCard title="Revenue YTD" subtitle="Jan–Jun 2026">
            {entities.sort((a, b) => b.m.revenue_ytd - a.m.revenue_ytd).map(({ slug, m, cfg }) => (
              <CompareRow key={slug} label={cfg.name} color={cfg.color}>
                <HBar value={m.revenue_ytd} max={maxRev} color={cfg.color} />
              </CompareRow>
            ))}
          </CompareCard>

          {/* Net income comparison */}
          <CompareCard title="Net Income YTD" subtitle="Jan–Jun 2026">
            {entities.sort((a, b) => b.m.net_income_ytd - a.m.net_income_ytd).map(({ slug, m, cfg }) => (
              <CompareRow key={slug} label={cfg.name} color={cfg.color}>
                <HBar value={m.net_income_ytd} max={maxNet} color={cfg.color} />
              </CompareRow>
            ))}
          </CompareCard>

          {/* Margin comparison */}
          <CompareCard title="Net Margin" subtitle="YTD %">
            {entities.sort((a, b) => b.m.net_margin_pct - a.m.net_margin_pct).map(({ slug, m, cfg }) => (
              <CompareRow key={slug} label={cfg.name} color={cfg.color}>
                <HBar value={m.net_margin_pct} max={100} color={cfg.color} />
              </CompareRow>
            ))}
          </CompareCard>

          {/* Cash on hand */}
          <CompareCard title="Cash on Hand" subtitle="As of Jun 30">
            {entities.sort((a, b) => b.m.cash_on_hand - a.m.cash_on_hand).map(({ slug, m, cfg }) => (
              <CompareRow key={slug} label={cfg.name} color={cfg.color}>
                <HBar value={m.cash_on_hand} max={maxCash} color={cfg.color} />
              </CompareRow>
            ))}
          </CompareCard>
        </div>

        {/* Portfolio monthly revenue + net income stacked */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Portfolio Revenue vs Net Income — Monthly</h3>
            <p className="text-[11px] text-gray-400">All entities combined</p>
          </div>
          <div className="px-4 py-4">
            <PortfolioChart data={portfolioMonthly} />
          </div>
        </div>

        {/* Margin scatter table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Entity Comparison Table</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Entity", "Revenue YTD", "Gross Margin", "Net Margin", "DSO", "DPO", "AR Overdue", "Cash", "Health"].map((h) => (
                  <th key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5 text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entities.sort((a, b) => b.m.revenue_ytd - a.m.revenue_ytd).map(({ slug, m, cfg, health }) => (
                <tr key={slug} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                    <span className="text-[12px] font-medium text-gray-800">{cfg.name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-gray-800">{fmt(m.revenue_ytd)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] text-gray-600">{pct(m.gross_margin_pct)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px]">
                    <span className={`font-semibold ${m.net_margin_pct >= 30 ? "text-emerald-600" : m.net_margin_pct >= 20 ? "text-amber-600" : "text-red-500"}`}>
                      {pct(m.net_margin_pct)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px]">
                    <span className={m.dso_days > 60 ? "text-red-600 font-semibold" : "text-gray-600"}>{m.dso_days}d</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px] text-gray-600">{m.dpo_days}d</td>
                  <td className="px-4 py-2.5 text-right text-[12px]">
                    <span className={m.ar_overdue_pct > 15 ? "text-red-600 font-semibold" : "text-gray-600"}>{pct(m.ar_overdue_pct)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-gray-800">{fmt(m.cash_on_hand)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      health >= 80 ? "bg-emerald-50 text-emerald-700" : health >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                    }`}>{health}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Monthly revenue per entity table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Monthly Revenue by Entity</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Entity</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{m}</th>
                  ))}
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide bg-gray-50">YTD</th>
                </tr>
              </thead>
              <tbody>
                {entities.sort((a, b) => b.m.revenue_ytd - a.m.revenue_ytd).map(({ slug, m, cfg, monthlyRevenue }) => (
                  <tr key={slug} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                      <span className="text-[12px] font-medium text-gray-800">{cfg.name}</span>
                    </td>
                    {monthlyRevenue.map((v, i) => (
                      <td key={i} className="px-3 py-2.5 text-right text-[12px] text-gray-700">{fmt(v)}</td>
                    ))}
                    <td className="px-4 py-2.5 text-right text-[12px] font-bold text-gray-900 bg-gray-50">{fmt(m.revenue_ytd)}</td>
                  </tr>
                ))}
                {/* Portfolio total row */}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-4 py-2.5 text-[12px] font-bold text-gray-900">Portfolio Total</td>
                  {portfolioMonthly.map((p, i) => (
                    <td key={i} className="px-3 py-2.5 text-right text-[12px] font-bold text-gray-900">{fmt(p.revenue)}</td>
                  ))}
                  <td className="px-4 py-2.5 text-right text-[12px] font-black text-gray-900">
                    {fmt(portfolioMonthly.reduce((s, p) => s + p.revenue, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className="text-[11px] font-semibold text-gray-800">{value}</span>
    </div>
  );
}

function CompareCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
        <p className="text-[10px] text-gray-400">{subtitle}</p>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function CompareRow({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <span className="text-[11px] text-gray-600 truncate">{label}</span>
      </div>
      {children}
    </div>
  );
}

function PortfolioChart({ data }: { data: { label: string; revenue: number; net_income: number }[] }) {
  const maxRev = Math.max(...data.map((d) => d.revenue));
  const H = 80, W = 560, gap = 8;
  const barW = (W - gap * (data.length - 1)) / data.length / 2 - 2;

  const netPts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.net_income / maxRev) * H;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: H }}>
        {data.map((d, i) => {
          const groupW = W / data.length;
          const x = i * groupW + gap / 2;
          const revH = (d.revenue / maxRev) * H;
          const niH  = (d.net_income / maxRev) * H;
          return (
            <g key={i}>
              <rect x={x} y={H - revH} width={barW} height={revH} rx={2} fill="#E5E7EB" />
              <rect x={x + barW + 2} y={H - niH} width={barW} height={niH} rx={2} fill="#10B981" />
            </g>
          );
        })}
        <polyline points={netPts} fill="none" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 2" strokeLinejoin="round" />
      </svg>
      <div className="flex items-center justify-between">
        {data.map((d) => (
          <div key={d.label} className="text-center">
            <p className="text-[10px] text-gray-400">{d.label}</p>
            <p className="text-[11px] font-semibold text-gray-700">{fmt(d.revenue)}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-gray-200" />
          <span className="text-[10px] text-gray-500">Revenue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-gray-500">Net Income</span>
        </div>
      </div>
    </div>
  );
}
