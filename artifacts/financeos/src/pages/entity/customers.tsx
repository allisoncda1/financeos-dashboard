import { useParams } from "wouter";
import NotFound from "@/pages/not-found";
import { ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import { useEntityCustomers } from "@/hooks/useApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { AgingTable } from "@/components/shared/AgingTable";
import { SparklineChart } from "@/components/shared/SparklineChart";
import { formatCurrency, formatPercent, formatDays, DASH } from "@/lib/format";


export function generateStaticParams() {
  return ENTITY_SLUGS.map((slug) => ({ slug }));
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  current: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Current" },
  overdue: { bg: "bg-amber-50",   text: "text-amber-700",   label: "Overdue" },
  late:    { bg: "bg-red-50",     text: "text-red-700",     label: "Late 90+" },
};

export default function CustomersPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug || !ENTITY_SLUGS.includes(slug as EntitySlug)) return <NotFound />;
  const eSlug = slug as EntitySlug;
  const { data: cust, source } = useEntityCustomers(eSlug);
  if (!cust) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }

  const overdueBuckets = cust.aging.slice(2);
  const overdueAmt = overdueBuckets.reduce((s, b) => s + b.amount, 0);
  const overduePct = cust.open_ar > 0 ? (overdueAmt / cust.open_ar) * 100 : null;
  const currentDso = cust.dso_history[cust.dso_history.length - 1];
  const prevDso    = cust.dso_history[0];
  const dsoDelta   = currentDso - prevDso;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <PageHeader entitySlug={eSlug} pageTitle="Customers & AR" asOf={cust.as_of} />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5">

        {/* Summary banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Open AR" value={formatCurrency(cust.open_ar)} sub="total outstanding" color="text-gray-900" />
          <SummaryCard label="Overdue AR" value={formatCurrency(overdueAmt)} sub={overduePct !== null ? `${formatPercent(overduePct)} of total` : DASH} color={overdueAmt > 0 ? "text-red-600" : "text-emerald-600"} />
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">DSO Trend (12M)</p>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className={`text-[20px] font-bold ${currentDso > 60 ? "text-red-600" : currentDso > 45 ? "text-amber-600" : "text-gray-900"}`}>
                  {cust.open_ar > 0 ? formatDays(currentDso) : "N/A"}
                </p>
                <p className={`text-[10px] font-medium ${dsoDelta !== null && dsoDelta > 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {dsoDelta !== null ? `${dsoDelta > 0 ? "+" : ""}${dsoDelta}d vs 12M ago` : "No trend data"}
                </p>
              </div>
              <div className="w-24 flex-shrink-0">
                <SparklineChart
                  data={cust.dso_history}
                  color={currentDso !== null && currentDso > 60 ? "#EF4444" : "#10B981"}
                  height={36}
                />
              </div>
            </div>
          </div>
          <SummaryCard label="Active Customers" value={`${cust.top_customers.length}+`} sub="in AR aging" color="text-gray-900" />
        </div>

        {/* AR Aging table */}
        <AgingTable buckets={cust.aging} total={cust.open_ar} label="AR" />

        {/* Top customers */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Top Customers by Balance</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Balance</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Last Payment</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">DSO</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {cust.top_customers.map((c, i) => {
                const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE.current;
                return (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-[12px] font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-right text-[12px] font-semibold text-gray-900">{formatCurrency(c.balance)}</td>
                    <td className="px-4 py-3 text-right text-[12px] text-gray-500">{c.last_payment_date}</td>
                    <td className={`px-4 py-3 text-right text-[12px] font-semibold ${c.dso_days > 60 ? "text-red-600" : c.dso_days > 45 ? "text-amber-600" : "text-gray-700"}`}>
                      {c.balance > 0 ? formatDays(c.dso_days) : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ss.bg} ${ss.text}`}>
                        {ss.label}
                      </span>
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
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-[20px] font-bold mt-1 ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
