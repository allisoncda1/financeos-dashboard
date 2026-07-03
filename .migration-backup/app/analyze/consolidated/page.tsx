"use client";

import { useState, useMemo } from "react";
import { getMockData, getFinancials } from "@/lib/mock";
import { ENTITY_SLUGS, ENTITY_CONFIG, ENTITY_META, type EntitySlug } from "@/lib/entities";
import { EntityLogo } from "@/components/ui/EntityLogo";
import { useEntitySelection } from "@/lib/entity-context";
import { Layers, ChevronUp, ChevronDown, Minus } from "lucide-react";

const ALL_FINS = Object.fromEntries(ENTITY_SLUGS.map(s => [s, getFinancials(s)])) as Record<EntitySlug, ReturnType<typeof getFinancials>>;
const DATA = getMockData();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

type SortDir = "asc" | "desc" | null;

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function pct(n: number) { return `${n.toFixed(1)}%`; }

const PL_ROWS = [
  { label: "Revenue",      key: "revenue"      as const, bold: false, indent: false, positive: true  },
  { label: "COGS",         key: "cogs"         as const, bold: false, indent: true,  positive: false },
  { label: "Gross Profit", key: "gross_profit" as const, bold: true,  indent: false, positive: true  },
  { label: "OpEx",         key: "opex"         as const, bold: false, indent: true,  positive: false },
  { label: "Net Income",   key: "net_income"   as const, bold: true,  indent: false, positive: true  },
] as const;

type EntityRow = {
  slug: EntitySlug;
  revenue: number; cogs: number; gross_profit: number; gross_margin: number;
  opex: number; net_income: number; net_margin: number;
};
type NumericEntityKey = Exclude<keyof EntityRow, "slug">;

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === "asc") return <ChevronUp className="w-3 h-3 inline ml-0.5" />;
  if (dir === "desc") return <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  return <Minus className="w-2.5 h-2.5 inline ml-0.5 opacity-30" />;
}

export default function ConsolidatedPage() {
  const { selected } = useEntitySelection();
  const [sortKey, setSortKey] = useState<NumericEntityKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const slugs = useMemo(() => ENTITY_SLUGS.filter(s => selected.includes(s)), [selected]);

  const consolidatedMonthly = useMemo(() => MONTHS.map((_, i) => {
    const revenue      = slugs.reduce((s, slug) => s + ALL_FINS[slug].monthly_pl[i].revenue, 0);
    const cogs         = slugs.reduce((s, slug) => s + ALL_FINS[slug].monthly_pl[i].cogs, 0);
    const gross_profit = slugs.reduce((s, slug) => s + ALL_FINS[slug].monthly_pl[i].gross_profit, 0);
    const opex         = slugs.reduce((s, slug) => s + ALL_FINS[slug].monthly_pl[i].opex, 0);
    const net_income   = slugs.reduce((s, slug) => s + ALL_FINS[slug].monthly_pl[i].net_income, 0);
    return { month: MONTHS[i], revenue, cogs, gross_profit, opex, net_income };
  }), [slugs]);

  const ytd = useMemo(() => ({
    revenue:      consolidatedMonthly.reduce((s, m) => s + m.revenue, 0),
    cogs:         consolidatedMonthly.reduce((s, m) => s + m.cogs, 0),
    gross_profit: consolidatedMonthly.reduce((s, m) => s + m.gross_profit, 0),
    opex:         consolidatedMonthly.reduce((s, m) => s + m.opex, 0),
    net_income:   consolidatedMonthly.reduce((s, m) => s + m.net_income, 0),
  }), [consolidatedMonthly]);

  const grossMarginPct = ytd.revenue > 0 ? (ytd.gross_profit / ytd.revenue) * 100 : 0;
  const netMarginPct   = ytd.revenue > 0 ? (ytd.net_income   / ytd.revenue) * 100 : 0;
  const opexPct        = ytd.revenue > 0 ? (ytd.opex         / ytd.revenue) * 100 : 0;
  const cogsPct        = ytd.revenue > 0 ? (ytd.cogs         / ytd.revenue) * 100 : 0;

  const totalAssets      = slugs.reduce((s, slug) => s + ALL_FINS[slug].balance_sheet.assets.total, 0);
  const totalLiabilities = slugs.reduce((s, slug) => s + ALL_FINS[slug].balance_sheet.liabilities.total, 0);
  const totalEquity      = slugs.reduce((s, slug) => s + ALL_FINS[slug].balance_sheet.equity.total, 0);
  const totalCash        = slugs.reduce((s, slug) => s + ALL_FINS[slug].balance_sheet.assets.cash, 0);
  const totalAR          = slugs.reduce((s, slug) => s + ALL_FINS[slug].balance_sheet.assets.accounts_receivable, 0);
  const totalAP          = slugs.reduce((s, slug) => s + ALL_FINS[slug].balance_sheet.liabilities.accounts_payable, 0);

  const entityContribs = useMemo(() =>
    slugs.map(slug => ({ slug, cfg: ENTITY_CONFIG[slug], m: DATA.metrics[slug] })),
    [slugs]
  );
  const totalRev = entityContribs.reduce((s, e) => s + e.m.revenue_ytd, 0);

  const entityRows: EntityRow[] = useMemo(() => slugs.map(slug => {
    const m = DATA.metrics[slug];
    return {
      slug,
      revenue: m.revenue_ytd, cogs: m.cogs_ytd, gross_profit: m.gross_profit_ytd,
      gross_margin: m.gross_margin_pct, opex: m.opex_ytd,
      net_income: m.net_income_ytd, net_margin: m.net_margin_pct,
    };
  }), [slugs]);

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDir) return entityRows;
    return [...entityRows].sort((a, b) =>
      sortDir === "asc" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
    );
  }, [entityRows, sortKey, sortDir]);

  const handleSort = (key: NumericEntityKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : d === "desc" ? null : "asc");
      if (sortDir === "desc") setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (slugs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <Layers className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-gray-500">No entities selected</p>
          <p className="text-[12px] text-gray-400 mt-1">Select at least one entity using the filter above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[14px] sm:text-[15px] font-bold text-gray-900 truncate">Consolidated Financials</h1>
            <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">
              {slugs.length} {slugs.length === 1 ? "entity" : "entities"} · YTD Jan–Jun 2026 · mock data
            </p>
          </div>
        </div>
        {/* Entity chips */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {slugs.map(slug => (
            <span key={slug} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold" style={{ background: `${ENTITY_META[slug].color}18`, color: ENTITY_META[slug].color }}>
              <EntityLogo entity={ENTITY_META[slug]} size={14} rounded="sm" />
              {ENTITY_META[slug].name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

        {/* Top KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: "Revenue",     value: fmt(ytd.revenue),      sub: "100% of base" },
            { label: "Gross Profit", value: fmt(ytd.gross_profit), sub: pct(grossMarginPct) + " margin" },
            { label: "OpEx",         value: fmt(ytd.opex),         sub: pct(opexPct) + " of rev" },
            { label: "Net Income",   value: fmt(ytd.net_income),   sub: pct(netMarginPct) + " margin" },
            { label: "COGS",         value: fmt(ytd.cogs),         sub: pct(cogsPct) + " of rev" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{c.label}</p>
              <p className="text-[17px] sm:text-[20px] font-bold text-gray-900 mt-1">{c.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue composition */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-[13px] font-semibold text-gray-900 mb-3">Revenue Composition — YTD</h3>
          <div className="h-5 flex rounded-lg overflow-hidden mb-3">
            {[...entityContribs].sort((a, b) => b.m.revenue_ytd - a.m.revenue_ytd).map(({ slug, cfg, m }) => (
              <div key={slug} style={{ width: `${(m.revenue_ytd / totalRev) * 100}%`, background: cfg.color }} title={`${cfg.name}: ${fmt(m.revenue_ytd)}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {[...entityContribs].sort((a, b) => b.m.revenue_ytd - a.m.revenue_ytd).map(({ slug, cfg, m }) => (
              <div key={slug} className="flex items-center gap-1.5">
                <EntityLogo entity={ENTITY_META[slug]} size={18} rounded="sm" />
                <span className="text-[11px] text-gray-600">{cfg.name}</span>
                <span className="text-[11px] font-semibold text-gray-900">{fmt(m.revenue_ytd)}</span>
                <span className="text-[10px] text-gray-400">{pct((m.revenue_ytd / totalRev) * 100)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Consolidated P&L — sticky header, horizontal scroll */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Consolidated P&L — Jan–Jun 2026</h3>
            <p className="text-[11px] text-gray-400">{slugs.length} {slugs.length === 1 ? "entity" : "entities"} aggregated</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-32">Line Item</th>
                  {MONTHS.map(m => (
                    <th key={m} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{m}</th>
                  ))}
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide bg-gray-50">YTD</th>
                </tr>
              </thead>
              <tbody>
                {PL_ROWS.map(row => (
                  <tr key={row.label} className={`${row.bold ? "border-t-2 border-gray-200" : "border-t border-gray-50"} hover:bg-gray-50`}>
                    <td className={`px-4 py-2.5 text-[12px] ${row.bold ? "font-bold text-gray-900" : row.indent ? "pl-7 text-gray-500" : "text-gray-600"}`}>{row.label}</td>
                    {consolidatedMonthly.map(m => (
                      <td key={m.month} className={`px-3 py-2.5 text-right text-[12px] ${row.bold ? "font-bold text-gray-800" : !row.positive ? "text-red-700" : "text-gray-700"}`}>{fmt(m[row.key])}</td>
                    ))}
                    <td className={`px-4 py-2.5 text-right text-[12px] bg-gray-50 ${row.bold ? "font-bold" : "font-semibold"} text-gray-900`}>{fmt(ytd[row.key])}</td>
                  </tr>
                ))}
                {[
                  { label: "Gross Margin %", values: consolidatedMonthly.map(m => m.revenue > 0 ? (m.gross_profit / m.revenue) * 100 : 0), ytdVal: grossMarginPct },
                  { label: "Net Margin %",   values: consolidatedMonthly.map(m => m.revenue > 0 ? (m.net_income / m.revenue) * 100 : 0), ytdVal: netMarginPct },
                ].map(row => (
                  <tr key={row.label} className="border-t border-dashed border-gray-200 bg-gray-50/50">
                    <td className="px-4 py-2 text-[10px] font-semibold text-gray-400 italic">{row.label}</td>
                    {row.values.map((v, i) => <td key={i} className="px-3 py-2 text-right text-[10px] text-gray-500">{pct(v)}</td>)}
                    <td className="px-4 py-2 text-right text-[10px] font-bold text-gray-700 bg-gray-50">{pct(row.ytdVal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Balance Sheet */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <BSCard title="Assets" total={totalAssets} color="#10B981">
            <BSRow label="Cash & Equivalents"  value={totalCash} />
            <BSRow label="Accounts Receivable" value={totalAR} />
            <BSRow label="Other Assets"        value={totalAssets - totalCash - totalAR} />
          </BSCard>
          <BSCard title="Liabilities" total={totalLiabilities} color="#EF4444">
            <BSRow label="Accounts Payable"    value={totalAP} />
            <BSRow label="Other Liabilities"   value={totalLiabilities - totalAP} />
          </BSCard>
          <BSCard title="Equity" total={totalEquity} color="#3B82F6">
            <BSRow label="Total Equity" value={totalEquity} />
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">Debt-to-Equity</span>
              <span className="text-[11px] font-semibold text-gray-700">{totalEquity > 0 ? (totalLiabilities / totalEquity).toFixed(2) : "—"}×</span>
            </div>
          </BSCard>
        </div>

        {/* Entity breakdown — sortable, sticky header */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">YTD Summary by Entity</h3>
            <p className="text-[11px] text-gray-400">Click column headers to sort</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <tr>
                  {[
                    { label: "Entity",       key: null as NumericEntityKey | null },
                    { label: "Revenue",      key: "revenue" as NumericEntityKey },
                    { label: "COGS",         key: "cogs" as NumericEntityKey },
                    { label: "Gross Profit", key: "gross_profit" as NumericEntityKey },
                    { label: "Gross Margin", key: "gross_margin" as NumericEntityKey },
                    { label: "OpEx",         key: "opex" as NumericEntityKey },
                    { label: "Net Income",   key: "net_income" as NumericEntityKey },
                    { label: "Net Margin",   key: "net_margin" as NumericEntityKey },
                  ].map(col => (
                    <th
                      key={col.label}
                      onClick={() => col.key && handleSort(col.key)}
                      className={`text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5 text-right first:text-left select-none ${col.key ? "cursor-pointer hover:text-gray-700 transition-colors" : ""} ${sortKey === col.key ? "text-gray-700" : ""}`}
                    >
                      {col.label}
                      {col.key && <SortIcon dir={sortKey === col.key ? sortDir : null} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => {
                  const cfg = ENTITY_CONFIG[row.slug];
                  return (
                    <tr key={row.slug} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <EntityLogo entity={ENTITY_META[row.slug]} size={20} rounded="md" />
                          <span className="text-[12px] font-medium text-gray-800">{cfg.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-gray-800">{fmt(row.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-red-700">{fmt(row.cogs)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-gray-700">{fmt(row.gross_profit)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-gray-600">{pct(row.gross_margin)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-red-700">{fmt(row.opex)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-emerald-700">{fmt(row.net_income)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px]">
                        <span className={`font-semibold ${row.net_margin >= 30 ? "text-emerald-600" : row.net_margin >= 20 ? "text-amber-600" : "text-red-500"}`}>
                          {pct(row.net_margin)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-4 py-2.5 text-[12px] font-bold text-gray-900">Total ({slugs.length})</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-gray-900">{fmt(ytd.revenue)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-red-700">{fmt(ytd.cogs)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-gray-900">{fmt(ytd.gross_profit)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-gray-700">{pct(grossMarginPct)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-red-700">{fmt(ytd.opex)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-emerald-700">{fmt(ytd.net_income)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold">
                    <span className={netMarginPct >= 30 ? "text-emerald-600" : netMarginPct >= 20 ? "text-amber-600" : "text-red-500"}>{pct(netMarginPct)}</span>
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

function BSCard({ title, total, color, children }: { title: string; total: number; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
        <span className="text-[14px] font-bold" style={{ color }}>{fmt(total)}</span>
      </div>
      <div className="p-4 space-y-2.5">{children}</div>
      <div className="px-4 py-3 border-t-2 border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-[12px] font-bold text-gray-900">Total {title}</span>
        <span className="text-[12px] font-bold text-gray-900">{fmt(total)}</span>
      </div>
    </div>
  );
}

function BSRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className="text-[12px] font-semibold text-gray-800">{fmt(value)}</span>
    </div>
  );
}
