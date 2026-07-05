import { useParams } from "wouter";
import NotFound from "@/pages/not-found";
import { ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import { useEntityFinancials } from "@/hooks/useApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabSwitcher } from "@/components/shared/TabSwitcher";
import {
  formatCurrency,
  formatPercent,
  formatMonthShort,
  isPartialMonth,
  PARTIAL_MONTH_NOTE,
} from "@/lib/format";


export function generateStaticParams() {
  return ENTITY_SLUGS.map((slug) => ({ slug }));
}

const fmt = (n: number) => formatCurrency(n);
/** Accountant-style cash-flow amounts: negatives in parentheses. */
function fmtCF(n: number): string {
  const s = formatCurrency(Math.abs(n));
  return n < 0 ? `(${s})` : s;
}
const pct = (n: number) => formatPercent(n);
const monthLabel = formatMonthShort;

const PL_ROWS = [
  { label: "Revenue",      key: "revenue" as const,      bold: false, border: false, positive: true },
  { label: "COGS",         key: "cogs" as const,          bold: false, border: false, positive: false },
  { label: "Gross Profit", key: "gross_profit" as const,  bold: true,  border: true,  positive: true },
  { label: "OpEx",         key: "opex" as const,          bold: false, border: false, positive: false },
  { label: "Net Income",   key: "net_income" as const,    bold: true,  border: true,  positive: true },
];

export default function FinancialsPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug || !ENTITY_SLUGS.includes(slug as EntitySlug)) return <NotFound />;
  const eSlug = slug as EntitySlug;
  const { data: fin, source } = useEntityFinancials(eSlug);
  if (!fin) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }
  const ytd = fin.ytd_summary;
  const bs = fin.balance_sheet;

  const grossMargin = ytd.revenue > 0 ? (ytd.gross_profit / ytd.revenue) * 100 : 0;
  const netMargin   = ytd.revenue > 0 ? (ytd.net_income  / ytd.revenue) * 100 : 0;
  const displayMonths = fin.monthly_pl;
  const monthRangeLabel = displayMonths.length > 0
    ? `${monthLabel(displayMonths[0].month)}–${monthLabel(displayMonths[displayMonths.length - 1].month)} ${displayMonths[0].month.slice(0, 4)}`
    : "";

  const plPanel = (
    <div className="px-6 py-5 space-y-5">
      {/* YTD summary cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Revenue",      value: fmt(ytd.revenue),      sub: "100%" },
          { label: "Gross Profit", value: fmt(ytd.gross_profit),  sub: pct(grossMargin) + " margin" },
          { label: "OpEx",         value: fmt(ytd.opex),          sub: pct((ytd.opex / ytd.revenue) * 100) + " of rev" },
          { label: "Net Income",   value: fmt(ytd.net_income),    sub: pct(netMargin) + " margin" },
          { label: "COGS",         value: fmt(ytd.cogs),          sub: pct((ytd.cogs / ytd.revenue) * 100) + " of rev" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{c.label} YTD</p>
            <p className="text-[20px] font-bold text-gray-900 mt-1">{c.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly P&L table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-[13px] font-semibold text-gray-900">Monthly P&L{monthRangeLabel ? ` — ${monthRangeLabel}` : ""}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-32">Line Item</th>
                {displayMonths.map((mp) => (
                  <th key={mp.month} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    {monthLabel(mp.month)}
                    {isPartialMonth(mp.month) && (
                      <span className="text-amber-500" title={PARTIAL_MONTH_NOTE}> *</span>
                    )}
                  </th>
                ))}
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide bg-gray-50">YTD</th>
              </tr>
            </thead>
            <tbody>
              {PL_ROWS.map((row) => {
                const ytdVal = ytd[row.key];
                return (
                  <tr
                    key={row.label}
                    className={`${row.border ? "border-t-2 border-gray-200" : "border-t border-gray-50"} hover:bg-gray-50 transition-colors`}
                  >
                    <td className={`px-4 py-2.5 text-[12px] ${row.bold ? "font-bold text-gray-900" : "text-gray-600"}`}>
                      {row.label}
                    </td>
                    {displayMonths.map((mp) => (
                      <td
                        key={mp.month}
                        className={`px-3 py-2.5 text-right text-[12px] ${
                          row.bold ? "font-bold" : "font-medium"
                        } ${!row.positive && !row.bold ? "text-red-700" : "text-gray-800"}`}
                      >
                        {fmt(mp[row.key])}
                      </td>
                    ))}
                    <td className={`px-4 py-2.5 text-right text-[12px] bg-gray-50 ${row.bold ? "font-bold" : "font-semibold"} text-gray-900`}>
                      {fmt(ytdVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {displayMonths.some((mp) => isPartialMonth(mp.month)) && (
          <p className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-50">
            <span className="text-amber-500">*</span> {PARTIAL_MONTH_NOTE}
          </p>
        )}
      </div>
    </div>
  );

  const bsPanel = (
    <div className="px-6 py-5 grid grid-cols-3 gap-4">
      <BSCard title="Assets" total={bs.assets.total} color="#10B981" items={[
        { label: "Cash & Equivalents",  value: bs.assets.cash },
        { label: "Accounts Receivable", value: bs.assets.accounts_receivable },
        { label: "Prepaid Expenses",    value: bs.assets.prepaid_expenses },
        { label: "Equipment (net)",     value: bs.assets.equipment_net },
      ]} />
      <BSCard title="Liabilities" total={bs.liabilities.total} color="#EF4444" items={[
        { label: "Accounts Payable",    value: bs.liabilities.accounts_payable },
        { label: "Accrued Liabilities", value: bs.liabilities.accrued_liabilities },
        { label: "Deferred Revenue",    value: bs.liabilities.deferred_revenue },
        { label: "Notes Payable",       value: bs.liabilities.notes_payable },
      ]} />
      <BSCard title="Equity" total={bs.equity.total} color="#3B82F6" items={[
        { label: "Paid-in Capital",     value: bs.equity.paid_in_capital },
        { label: "Retained Earnings",   value: bs.equity.retained_earnings },
      ]} />
    </div>
  );

  const cf = fin.cash_flow;
  const cfPanel = cf ? (
    <div className="px-6 py-5 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ...cf.sections.map((s) => ({ label: `Net Cash — ${s.name}`, value: s.net_cash })),
          ...(cf.net_cash_change !== null ? [{ label: "Net Cash Change", value: cf.net_cash_change }] : []),
          ...(cf.cash_at_end !== null ? [{ label: "Cash at End of Period", value: cf.cash_at_end }] : []),
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{c.label}</p>
            <p className={`text-[20px] font-bold mt-1 ${c.value < 0 ? "text-red-700" : "text-gray-900"}`}>{fmtCF(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Statement */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-[13px] font-semibold text-gray-900">Statement of Cash Flows — as of {cf.as_of}</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {cf.sections.map((section) => (
            <div key={section.name} className="px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{section.name}</p>
              <div className="space-y-1.5">
                {section.lines.map((line, i) => (
                  <div key={`${line.label}-${i}`} className="flex items-center justify-between">
                    <span className={`text-[12px] ${line.is_subtotal ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                      {line.label}
                    </span>
                    <span className={`text-[12px] ${line.is_subtotal ? "font-semibold" : "font-medium"} ${line.amount < 0 ? "text-red-700" : "text-gray-800"}`}>
                      {fmtCF(line.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                <span className="text-[12px] font-bold text-gray-900">Net cash from {section.name.toLowerCase()}</span>
                <span className={`text-[12px] font-bold ${section.net_cash < 0 ? "text-red-700" : "text-gray-900"}`}>
                  {fmtCF(section.net_cash)}
                </span>
              </div>
            </div>
          ))}
          {(cf.net_cash_change !== null || cf.cash_at_end !== null) && (
            <div className="px-4 py-3 bg-gray-50 space-y-1.5">
              {cf.net_cash_change !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-gray-900">Net cash change for period</span>
                  <span className={`text-[12px] font-bold ${cf.net_cash_change < 0 ? "text-red-700" : "text-gray-900"}`}>
                    {fmtCF(cf.net_cash_change)}
                  </span>
                </div>
              )}
              {cf.cash_at_end !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-gray-900">Cash at end of period</span>
                  <span className={`text-[12px] font-bold ${cf.cash_at_end < 0 ? "text-red-700" : "text-gray-900"}`}>
                    {fmtCF(cf.cash_at_end)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="px-6 py-5">
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center">
        <p className="text-[13px] font-semibold text-gray-900">Cash flow statement is not available yet from FinanceOS Core.</p>
        <p className="text-[12px] text-gray-500 mt-1 max-w-md mx-auto">
          See the P&amp;L and Balance Sheet tabs for available figures.
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <PageHeader entitySlug={eSlug} pageTitle="Financials" asOf={fin.as_of} />
      <TabSwitcher panels={[
        { id: "pl", label: "P&L",           content: plPanel },
        { id: "bs", label: "Balance Sheet", content: bsPanel },
        { id: "cf", label: "Cash Flow",     content: cfPanel },
      ]} />
    </div>
  );
}

function BSCard({ title, total, color, items }: { title: string; total: number; color: string; items: { label: string; value: number }[] }) {
  // Core provides only section totals for some entities — the sub-line
  // breakdown comes through as all-zero. Rather than render misleading $0
  // rows against a non-zero total, show the authoritative total only.
  const allZero = items.every((i) => i.value === 0);
  const breakdownUnavailable = allZero && total !== 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
        <span className="text-[14px] font-bold" style={{ color }}>{fmt(total)}</span>
      </div>
      <div className="p-4 space-y-2">
        {breakdownUnavailable ? (
          <p className="text-[11px] text-gray-400 italic py-1">Breakdown unavailable — total shown</p>
        ) : (
          items.map((i) => <BSRow key={i.label} label={i.label} value={i.value} />)
        )}
      </div>
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
      <span className="text-[12px] text-gray-600">{label}</span>
      <span className="text-[12px] font-semibold text-gray-800">{fmt(value)}</span>
    </div>
  );
}
