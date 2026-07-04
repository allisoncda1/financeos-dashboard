import { useParams } from "wouter";
import NotFound from "@/pages/not-found";
import { ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import { useEntityFinancials } from "@/hooks/useApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabSwitcher } from "@/components/shared/TabSwitcher";


export function generateStaticParams() {
  return ENTITY_SLUGS.map((slug) => ({ slug }));
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}
function fmtCF(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}K` : `$${abs}`;
  return n < 0 ? `(${s})` : s;
}
function pct(n: number): string { return `${n.toFixed(1)}%`; }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

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
  const displayMonths = fin.monthly_pl.slice(0, MONTHS.length);

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
          <h3 className="text-[13px] font-semibold text-gray-900">Monthly P&L — Jan–Jun 2026</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-32">Line Item</th>
                {MONTHS.map((m) => (
                  <th key={m} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{m}</th>
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
      </div>
    </div>
  );

  const bsPanel = (
    <div className="px-6 py-5 grid grid-cols-3 gap-4">
      <BSCard title="Assets" total={bs.assets.total} color="#10B981">
        <BSRow label="Cash & Equivalents"  value={bs.assets.cash} />
        <BSRow label="Accounts Receivable" value={bs.assets.accounts_receivable} />
        <BSRow label="Prepaid Expenses"    value={bs.assets.prepaid_expenses} />
        <BSRow label="Equipment (net)"     value={bs.assets.equipment_net} />
      </BSCard>
      <BSCard title="Liabilities" total={bs.liabilities.total} color="#EF4444">
        <BSRow label="Accounts Payable"    value={bs.liabilities.accounts_payable} />
        <BSRow label="Accrued Liabilities" value={bs.liabilities.accrued_liabilities} />
        <BSRow label="Deferred Revenue"    value={bs.liabilities.deferred_revenue} />
        <BSRow label="Notes Payable"       value={bs.liabilities.notes_payable} />
      </BSCard>
      <BSCard title="Equity" total={bs.equity.total} color="#3B82F6">
        <BSRow label="Paid-in Capital"     value={bs.equity.paid_in_capital} />
        <BSRow label="Retained Earnings"   value={bs.equity.retained_earnings} />
      </BSCard>
    </div>
  );

  const cfNetOps  = ytd.net_income + Math.round(ytd.opex * 0.08) - Math.round(ytd.revenue * 0.03) + Math.round(ytd.cogs * 0.02);
  const cfInvest  = -Math.round(ytd.opex * 0.12);
  const cfFinance = -Math.round(ytd.opex * 0.05);

  const cfPanel = (
    <div className="px-6 py-5 space-y-4">
      <CFCard title="Operating Activities" color="#10B981">
        <CFRow label="Net Income"                      value={ytd.net_income} />
        <CFRow label="Depreciation & Amortization"     value={Math.round(ytd.opex * 0.08)} />
        <CFRow label="Change in Accounts Receivable"   value={-Math.round(ytd.revenue * 0.03)} />
        <CFRow label="Change in Accounts Payable"      value={Math.round(ytd.cogs * 0.02)} />
        <CFRow label="Net Cash from Operations"        value={cfNetOps} bold />
      </CFCard>
      <CFCard title="Investing Activities" color="#F59E0B">
        <CFRow label="Purchase of Equipment"           value={cfInvest} />
        <CFRow label="Net Cash from Investing"         value={cfInvest} bold />
      </CFCard>
      <CFCard title="Financing Activities" color="#8B5CF6">
        <CFRow label="Loan Repayments"                 value={cfFinance} />
        <CFRow label="Net Cash from Financing"         value={cfFinance} bold />
      </CFCard>
      <div className="bg-gray-900 text-white rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-[12px] font-bold">Net Change in Cash (YTD)</span>
        <span className={`text-[14px] font-bold ${cfNetOps + cfInvest + cfFinance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {fmtCF(cfNetOps + cfInvest + cfFinance)}
        </span>
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

function BSCard({ title, total, color, children }: { title: string; total: number; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
        <span className="text-[14px] font-bold" style={{ color }}>{fmt(total)}</span>
      </div>
      <div className="p-4 space-y-2">{children}</div>
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

function CFCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function CFRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "border-t border-gray-200 pt-2 mt-1" : ""}`}>
      <span className={`text-[12px] ${bold ? "font-bold text-gray-900" : "text-gray-600"}`}>{label}</span>
      <span className={`text-[12px] ${bold ? "font-bold" : "font-semibold"} ${value < 0 ? "text-red-700" : "text-gray-800"}`}>
        {fmtCF(value)}
      </span>
    </div>
  );
}
