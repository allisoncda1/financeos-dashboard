"use client";

import { useMemo, useState } from "react";
import { getMockData, getFinancials } from "@/lib/mock";
import { ENTITY_SLUGS, ENTITY_CONFIG, type EntitySlug } from "@/lib/types";
import { useEntitySelection } from "@/lib/entity-context";
import { computeHealthScore } from "@/lib/briefing";
import { TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown } from "lucide-react";

const ALL_FINS = Object.fromEntries(ENTITY_SLUGS.map(s => [s, getFinancials(s)])) as Record<EntitySlug, ReturnType<typeof getFinancials>>;
const DATA = getMockData();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function pct(n: number) { return `${n.toFixed(1)}%`; }

function Spark({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values); const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80, H = 24;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="flex-1 flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
      </div>
      <span className="text-[11px] font-semibold text-gray-800 w-14 text-right">{fmt(value)}</span>
    </div>
  );
}

type SortDir = "asc" | "desc" | null;
type SortKey = "revenue_ytd" | "gross_margin_pct" | "net_margin_pct" | "dso_days" | "cash_on_hand" | "health";

export default function PerformancePage() {
  const { selected } = useEntitySelection();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const slugs = useMemo(() => ENTITY_SLUGS.filter(s => selected.includes(s)), [selected]);

  const entities = useMemo(() => slugs.map(slug => {
    const m = DATA.metrics[slug];
    const cfg = ENTITY_CONFIG[slug];
    const fin = ALL_FINS[slug];
    const health = computeHealthScore(m);
    const monthlyRevenue = fin.monthly_pl.map(p => p.revenue);
    const monthlyNet     = fin.monthly_pl.map(p => p.net_income);
    const revTrend = monthlyRevenue[5] - monthlyRevenue[0];
    return { slug, m, cfg, health, monthlyRevenue, monthlyNet, revTrend };
  }), [slugs]);

  const maxRev    = Math.max(1, ...entities.map(e => e.m.revenue_ytd));
  const maxNet    = Math.max(1, ...entities.map(e => e.m.net_income_ytd));
  const maxCash   = Math.max(1, ...entities.map(e => e.m.cash_on_hand));

  const portfolioMonthly = useMemo(() => MONTHS.map((_, i) => ({
    label: MONTHS[i],
    revenue:    slugs.reduce((s, slug) => s + ALL_FINS[slug].monthly_pl[i].revenue, 0),
    net_income: slugs.reduce((s, slug) => s + ALL_FINS[slug].monthly_pl[i].net_income, 0),
  })), [slugs]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      const next: SortDir = sortDir === "desc" ? "asc" : sortDir === "asc" ? null : "desc";
      setSortDir(next);
      if (!next) setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedEntities = useMemo(() => {
    if (!sortKey || !sortDir) return entities;
    return [...entities].sort((a, b) => {
      const av = sortKey === "health" ? a.health : a.m[sortKey as keyof typeof a.m] as number;
      const bv = sortKey === "health" ? b.health : b.m[sortKey as keyof typeof b.m] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [entities, sortKey, sortDir]);

  if (slugs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-gray-500">No entities selected</p>
          <p className="text-[12px] text-gray-400 mt-1">Select at least one entity using the filter above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-[14px] sm:text-[15px] font-bold text-gray-900">Entity Performance</h1>
            <p className="text-[10px] sm:text-[11px] text-gray-400">YTD comparison · Jan–Jun 2026 · mock data</p>
          </div>
        </div>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full flex-shrink-0">{slugs.length} entities</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

        {/* Scorecards */}
        <div className={`grid gap-3 ${slugs.length === 1 ? "grid-cols-1 max-w-xs" : slugs.length === 2 ? "grid-cols-1 sm:grid-cols-2" : slugs.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-2 md:grid-cols-4"}`}>
          {entities.map(({ slug, m, cfg, health, monthlyRevenue, revTrend }) => (
            <div key={slug} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                <span className="text-[12px] font-bold text-gray-900 truncate">{cfg.name}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] text-gray-400">Health Score</p>
                  <p className="text-[22px] font-black" style={{ color: health >= 80 ? "#10B981" : health >= 60 ? "#F59E0B" : "#EF4444" }}>{health}</p>
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
                {revTrend > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : revTrend < 0 ? <TrendingDown className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3 text-gray-400" />}
                <span className={`text-[10px] font-medium ${revTrend > 0 ? "text-emerald-600" : revTrend < 0 ? "text-red-600" : "text-gray-400"}`}>
                  {revTrend > 0 ? "+" : ""}{fmt(revTrend)} Jan→Jun
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bar comparisons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CompareCard title="Revenue YTD" subtitle="Jan–Jun 2026">
            {[...entities].sort((a, b) => b.m.revenue_ytd - a.m.revenue_ytd).map(({ slug, m, cfg }) => (
              <CompareRow key={slug} label={cfg.name} color={cfg.color}><HBar value={m.revenue_ytd} max={maxRev} color={cfg.color} /></CompareRow>
            ))}
          </CompareCard>
          <CompareCard title="Net Income YTD" subtitle="Jan–Jun 2026">
            {[...entities].sort((a, b) => b.m.net_income_ytd - a.m.net_income_ytd).map(({ slug, m, cfg }) => (
              <CompareRow key={slug} label={cfg.name} color={cfg.color}><HBar value={m.net_income_ytd} max={maxNet} color={cfg.color} /></CompareRow>
            ))}
          </CompareCard>
          <CompareCard title="Net Margin" subtitle="YTD %">
            {[...entities].sort((a, b) => b.m.net_margin_pct - a.m.net_margin_pct).map(({ slug, m, cfg }) => (
              <CompareRow key={slug} label={cfg.name} color={cfg.color}><HBar value={m.net_margin_pct} max={100} color={cfg.color} /></CompareRow>
            ))}
          </CompareCard>
          <CompareCard title="Cash on Hand" subtitle="As of Jun 30">
            {[...entities].sort((a, b) => b.m.cash_on_hand - a.m.cash_on_hand).map(({ slug, m, cfg }) => (
              <CompareRow key={slug} label={cfg.name} color={cfg.color}><HBar value={m.cash_on_hand} max={maxCash} color={cfg.color} /></CompareRow>
            ))}
          </CompareCard>
        </div>

        {/* Monthly chart */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Revenue vs Net Income — Monthly</h3>
            <p className="text-[11px] text-gray-400">{slugs.length} {slugs.length === 1 ? "entity" : "entities"} combined</p>
          </div>
          <div className="px-4 py-4">
            <PortfolioChart data={portfolioMonthly} />
          </div>
        </div>

        {/* Sortable comparison table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Entity Comparison Table</h3>
            <p className="text-[11px] text-gray-400">Click column headers to sort</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <tr>
                  {[
                    { label: "Entity",      key: null },
                    { label: "Revenue",     key: "revenue_ytd" as SortKey },
                    { label: "Gross Mgn",   key: "gross_margin_pct" as SortKey },
                    { label: "Net Mgn",     key: "net_margin_pct" as SortKey },
                    { label: "DSO",         key: "dso_days" as SortKey },
                    { label: "AR Overdue",  key: null },
                    { label: "Cash",        key: "cash_on_hand" as SortKey },
                    { label: "Health",      key: "health" as SortKey },
                  ].map(col => (
                    <th
                      key={col.label}
                      onClick={() => col.key && handleSort(col.key)}
                      className={`text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5 text-right first:text-left select-none ${col.key ? "cursor-pointer hover:text-gray-700 transition-colors" : ""} ${sortKey === col.key ? "text-gray-700" : ""}`}
                    >
                      {col.label}
                      {col.key && (sortKey === col.key ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />) : <Minus className="w-2.5 h-2.5 inline ml-0.5 opacity-30" />)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedEntities.map(({ slug, m, cfg, health }) => (
                  <tr key={slug} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                        <span className="text-[12px] font-medium text-gray-800">{cfg.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-gray-800">{fmt(m.revenue_ytd)}</td>
                    <td className="px-4 py-2.5 text-right text-[12px] text-gray-600">{pct(m.gross_margin_pct)}</td>
                    <td className="px-4 py-2.5 text-right text-[12px]">
                      <span className={`font-semibold ${m.net_margin_pct >= 30 ? "text-emerald-600" : m.net_margin_pct >= 20 ? "text-amber-600" : "text-red-500"}`}>{pct(m.net_margin_pct)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12px]">
                      <span className={m.dso_days > 60 ? "text-red-600 font-semibold" : "text-gray-600"}>{m.dso_days}d</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12px]">
                      <span className={m.ar_overdue_pct > 15 ? "text-red-600 font-semibold" : "text-gray-600"}>{pct(m.ar_overdue_pct)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-gray-800">{fmt(m.cash_on_hand)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${health >= 80 ? "bg-emerald-50 text-emerald-700" : health >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{health}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-[12px] font-semibold text-gray-900 mb-0.5">{title}</h3>
      <p className="text-[10px] text-gray-400 mb-3">{subtitle}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CompareRow({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-[10px] text-gray-500 w-20 flex-shrink-0 truncate">{label}</span>
      {children}
    </div>
  );
}

function PortfolioChart({ data }: { data: { label: string; revenue: number; net_income: number }[] }) {
  const maxRev = Math.max(...data.map(d => d.revenue));
  const maxNet = Math.max(...data.map(d => d.net_income));
  const maxVal = Math.max(maxRev, maxNet, 1);
  const H = 100;
  const W = 100 / (data.length - 1);
  const revPts = data.map((d, i) => `${i * W}%,${H - (d.revenue / maxVal) * H}`).join(" ");
  const netPts = data.map((d, i) => `${i * W}%,${H - (d.net_income / maxVal) * H}`).join(" ");

  return (
    <div className="w-full">
      <svg className="w-full" height="100" viewBox={`0 0 100 100`} preserveAspectRatio="none">
        <polyline points={revPts} fill="none" stroke="#10B981" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        <polyline points={netPts} fill="none" stroke="#3B82F6" strokeWidth="0.8" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between mt-1">
        {data.map(d => <span key={d.label} className="text-[9px] text-gray-400">{d.label}</span>)}
      </div>
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1"><span className="w-4 h-0.5 bg-emerald-500 block" /><span className="text-[10px] text-gray-500">Revenue</span></div>
        <div className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500 block" style={{ borderTop: "1.5px dashed #3B82F6" }} /><span className="text-[10px] text-gray-500">Net Income</span></div>
      </div>
    </div>
  );
}
