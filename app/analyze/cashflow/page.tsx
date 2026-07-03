"use client";

import { useMemo } from "react";
import { getMockData, getFinancials, getBanking } from "@/lib/mock";
import { ENTITY_SLUGS, ENTITY_CONFIG, type EntitySlug } from "@/lib/types";
import { useEntitySelection } from "@/lib/entity-context";
import { Droplets } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

// Pre-load all data at module level (server-safe synchronous mock)
const ALL_DATA = getMockData();
const ALL_FINS = Object.fromEntries(ENTITY_SLUGS.map(s => [s, getFinancials(s)])) as Record<EntitySlug, ReturnType<typeof getFinancials>>;
const ALL_BANKING = Object.fromEntries(ENTITY_SLUGS.map(s => [s, getBanking(s)])) as Record<EntitySlug, ReturnType<typeof getBanking>>;

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${n < 0 ? "(" : ""}$${(Math.abs(n) / 1_000_000).toFixed(2)}M${n < 0 ? ")" : ""}`;
  if (Math.abs(n) >= 1_000) return `${n < 0 ? "(" : ""}$${(Math.abs(n) / 1_000).toFixed(0)}K${n < 0 ? ")" : ""}`;
  return `${n < 0 ? "(" : ""}$${Math.abs(n)}${n < 0 ? ")" : ""}`;
}
function fmtPlain(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(Math.abs(n) / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(Math.abs(n) / 1_000).toFixed(0)}K`;
  return `$${Math.abs(n)}`;
}

function deriveCF(fin: ReturnType<typeof getFinancials>) {
  return fin.monthly_pl.map(m => {
    const ops    = m.net_income + Math.round(m.opex * 0.08) - Math.round(m.revenue * 0.03) + Math.round(m.cogs * 0.02);
    const invest = -Math.round(m.opex * 0.12);
    const fin2   = -Math.round(m.opex * 0.05);
    return { month: m.month, ops, invest, fin: fin2, net: ops + invest + fin2 };
  });
}

export default function CashFlowPage() {
  const { selected } = useEntitySelection();
  const slugs = useMemo(() => ENTITY_SLUGS.filter(s => selected.includes(s)), [selected]);

  const consolidatedCF = useMemo(() => MONTHS.map((_, i) => ({
    label: MONTHS[i],
    ops:    slugs.reduce((s, slug) => s + deriveCF(ALL_FINS[slug])[i].ops, 0),
    invest: slugs.reduce((s, slug) => s + deriveCF(ALL_FINS[slug])[i].invest, 0),
    fin:    slugs.reduce((s, slug) => s + deriveCF(ALL_FINS[slug])[i].fin, 0),
    net:    slugs.reduce((s, slug) => s + deriveCF(ALL_FINS[slug])[i].net, 0),
  })), [slugs]);

  const ytdNet    = useMemo(() => consolidatedCF.reduce((s, m) => s + m.net, 0), [consolidatedCF]);
  const ytdOps    = useMemo(() => consolidatedCF.reduce((s, m) => s + m.ops, 0), [consolidatedCF]);
  const ytdInvest = useMemo(() => consolidatedCF.reduce((s, m) => s + m.invest, 0), [consolidatedCF]);
  const ytdFin    = useMemo(() => consolidatedCF.reduce((s, m) => s + m.fin, 0), [consolidatedCF]);

  const totalCash = useMemo(() => slugs.reduce((s, slug) => s + ALL_DATA.metrics[slug].cash_on_hand, 0), [slugs]);
  const totalAR   = useMemo(() => slugs.reduce((s, slug) => s + ALL_DATA.metrics[slug].open_ar, 0), [slugs]);
  const totalAP   = useMemo(() => slugs.reduce((s, slug) => s + ALL_DATA.metrics[slug].open_ap, 0), [slugs]);

  const maxAbsNet = useMemo(() => Math.max(1, ...consolidatedCF.map(m => Math.abs(m.net))), [consolidatedCF]);

  let running = 0;
  const runningBalances = consolidatedCF.map(m => { running += m.net; return running; });

  if (slugs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <Droplets className="w-10 h-10 text-gray-200 mx-auto mb-3" />
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
          <div className="w-8 h-8 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
            <Droplets className="w-4 h-4 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-[14px] sm:text-[15px] font-bold text-gray-900">Cash Flow Analysis</h1>
            <p className="text-[10px] sm:text-[11px] text-gray-400">Derived from P&L · YTD Jan–Jun 2026 · mock data</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${ytdNet >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          YTD Net: {fmt(ytdNet)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Cash on Hand",      value: fmtPlain(totalCash), color: "#10B981", sub: `${slugs.length} ${slugs.length === 1 ? "entity" : "entities"} combined` },
            { label: "YTD Operating Cash Flow", value: fmt(ytdOps),          color: "#3B82F6", sub: "Net income + adjustments" },
            { label: "YTD Net Cash Change",     value: fmt(ytdNet),          color: ytdNet >= 0 ? "#10B981" : "#EF4444", sub: "Ops + Invest + Fin" },
            { label: "Portfolio AR",            value: fmtPlain(totalAR),    color: "#F59E0B", sub: "Pending collection" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{c.label}</p>
              <p className="text-[16px] sm:text-[20px] font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Monthly net cash bar chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-[13px] font-semibold text-gray-900 mb-1">Portfolio Net Cash Flow — Monthly</h3>
            <p className="text-[11px] text-gray-400 mb-4">Positive = inflow · Negative = outflow</p>
            <div className="space-y-2">
              {consolidatedCF.map(m => {
                const isPos = m.net >= 0;
                const w = maxAbsNet > 0 ? Math.abs(m.net) / maxAbsNet * 100 : 0;
                return (
                  <div key={m.label} className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-400 w-6">{m.label}</span>
                    <div className="flex-1 flex items-center h-6 relative">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200" />
                      {isPos ? (
                        <div className="absolute left-1/2 h-4 top-1 rounded-r" style={{ width: `${w / 2}%`, background: "#10B981" }} />
                      ) : (
                        <div className="absolute h-4 top-1 rounded-l" style={{ right: "50%", width: `${w / 2}%`, background: "#EF4444" }} />
                      )}
                    </div>
                    <span className={`text-[11px] font-semibold w-16 text-right ${isPos ? "text-emerald-600" : "text-red-600"}`}>
                      {fmt(m.net)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-emerald-500" /><span className="text-[10px] text-gray-500">Inflow</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-red-400" /><span className="text-[10px] text-gray-500">Outflow</span></div>
            </div>
          </div>

          {/* Cash by activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-[13px] font-semibold text-gray-900 mb-1">Cash by Activity — YTD</h3>
            <p className="text-[11px] text-gray-400 mb-4">Operating / Investing / Financing</p>
            <div className="space-y-4">
              {[
                { label: "Operating Activities",  value: ytdOps,    color: "#10B981", note: "Net income + D&A – AR change + AP change" },
                { label: "Investing Activities",  value: ytdInvest, color: "#F59E0B", note: "Capital expenditures on equipment" },
                { label: "Financing Activities",  value: ytdFin,    color: "#8B5CF6", note: "Loan repayments" },
              ].map(row => (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                      <span className="text-[12px] font-medium text-gray-700">{row.label}</span>
                    </div>
                    <span className={`text-[13px] font-bold ${row.value >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(row.value)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 pl-4">{row.note}</p>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-4">
                    <div className="h-full rounded-full" style={{ width: `${Math.abs(row.value) / Math.max(Math.abs(ytdOps), 1) * 100}%`, background: row.color }} />
                  </div>
                </div>
              ))}
              <div className="border-t-2 border-gray-200 pt-3 flex items-center justify-between">
                <span className="text-[12px] font-bold text-gray-900">Net Cash Change (YTD)</span>
                <span className={`text-[14px] font-black ${ytdNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(ytdNet)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Consolidated CF statement table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Consolidated Cash Flow Statement</h3>
            <p className="text-[11px] text-gray-400">{slugs.length} {slugs.length === 1 ? "entity" : "entities"} · derived from P&L</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-40">Activity</th>
                  {MONTHS.map(m => <th key={m} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{m}</th>)}
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide bg-gray-50">YTD</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Operating",  key: "ops"    as const, ytd: ytdOps,    color: "text-emerald-700" },
                  { label: "Investing",  key: "invest" as const, ytd: ytdInvest, color: "text-amber-700" },
                  { label: "Financing",  key: "fin"    as const, ytd: ytdFin,    color: "text-purple-700" },
                ].map(row => (
                  <tr key={row.label} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className={`px-4 py-2.5 text-[12px] font-medium ${row.color}`}>{row.label}</td>
                    {consolidatedCF.map(m => (
                      <td key={m.label} className={`px-3 py-2.5 text-right text-[12px] ${m[row.key] >= 0 ? "text-gray-700" : "text-red-700"}`}>{fmt(m[row.key])}</td>
                    ))}
                    <td className={`px-4 py-2.5 text-right text-[12px] font-bold bg-gray-50 ${row.ytd >= 0 ? "text-gray-900" : "text-red-700"}`}>{fmt(row.ytd)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-4 py-2.5 text-[12px] font-bold text-gray-900">Net Cash Change</td>
                  {consolidatedCF.map(m => (
                    <td key={m.label} className={`px-3 py-2.5 text-right text-[12px] font-bold ${m.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(m.net)}</td>
                  ))}
                  <td className={`px-4 py-2.5 text-right text-[12px] font-black bg-gray-50 ${ytdNet >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(ytdNet)}</td>
                </tr>
                <tr className="border-t border-dashed border-gray-200">
                  <td className="px-4 py-2 text-[10px] font-semibold text-gray-400 italic">Cumulative</td>
                  {runningBalances.map((v, i) => (
                    <td key={i} className={`px-3 py-2 text-right text-[10px] font-semibold ${v >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(v)}</td>
                  ))}
                  <td className="px-4 py-2 bg-gray-50" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Per-entity cash table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Cash Position by Entity</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <tr>
                  {["Entity", "Cash on Hand", "Open AR", "Open AP", "YTD Ops CF", "YTD Net CF", "Bank Accounts"].map(h => (
                    <th key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5 text-right first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slugs.map(slug => {
                  const m = ALL_DATA.metrics[slug];
                  const cfg = ENTITY_CONFIG[slug];
                  const monthly = deriveCF(ALL_FINS[slug]);
                  const entYtdOps = monthly.reduce((s, mo) => s + mo.ops, 0);
                  const entYtdNet = monthly.reduce((s, mo) => s + mo.net, 0);
                  const bk = ALL_BANKING[slug];
                  return (
                    <tr key={slug} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                          <span className="text-[12px] font-medium text-gray-800">{cfg.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-emerald-700">{fmtPlain(m.cash_on_hand)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-amber-700">{fmtPlain(m.open_ar)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-red-700">{fmtPlain(m.open_ap)}</td>
                      <td className={`px-4 py-2.5 text-right text-[12px] font-medium ${entYtdOps >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(entYtdOps)}</td>
                      <td className={`px-4 py-2.5 text-right text-[12px] font-semibold ${entYtdNet >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(entYtdNet)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-gray-600">{bk.accounts.length} accounts</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-4 py-2.5 text-[12px] font-bold text-gray-900">Portfolio Total</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-emerald-700">{fmtPlain(totalCash)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-amber-700">{fmtPlain(totalAR)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-red-700">{fmtPlain(totalAP)}</td>
                  <td className={`px-4 py-2.5 text-right text-[12px] font-bold ${ytdOps >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(ytdOps)}</td>
                  <td className={`px-4 py-2.5 text-right text-[12px] font-black ${ytdNet >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(ytdNet)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-gray-700">{slugs.reduce((s, slug) => s + ALL_BANKING[slug].accounts.length, 0)} accounts</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
