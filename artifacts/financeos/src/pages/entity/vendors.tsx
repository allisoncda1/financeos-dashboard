import { useParams } from "wouter";
import NotFound from "@/pages/not-found";
import { ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import { useEntityVendors } from "@/hooks/useApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { AgingTable } from "@/components/shared/AgingTable";
import { SparklineChart } from "@/components/shared/SparklineChart";
import { formatCurrency, formatPercent } from "@/lib/format";


export function generateStaticParams() {
  return ENTITY_SLUGS.map((slug) => ({ slug }));
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  current:   { bg: "bg-emerald-50", text: "text-emerald-700", label: "Current" },
  scheduled: { bg: "bg-blue-50",    text: "text-blue-700",    label: "Scheduled" },
  overdue:   { bg: "bg-red-50",     text: "text-red-700",     label: "Overdue" },
};

export default function VendorsPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug || !ENTITY_SLUGS.includes(slug as EntitySlug)) return <NotFound />;
  const eSlug = slug as EntitySlug;
  const { data: vend, source } = useEntityVendors(eSlug);
  if (!vend) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }

  // Buckets: [0]=Current, [1]=1-30 (already overdue), [2]=31-60, [3]=61-90, [4]=90+
  const overdueAmt = vend.aging.slice(1).reduce((s, b) => s + b.amount, 0);
  const overduePct = vend.open_ap > 0 ? (overdueAmt / vend.open_ap) * 100 : 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <PageHeader entitySlug={eSlug} pageTitle="Vendors & AP" asOf={vend.as_of} />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5">

        {/* Summary banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Open AP" value={formatCurrency(vend.open_ap)} sub="total outstanding" color="text-gray-900" />
          <SummaryCard
            label="Overdue AP"
            value={formatCurrency(overdueAmt)}
            sub={overdueAmt > 0 ? `${formatPercent(overduePct)} of total` : "All current"}
            color={overdueAmt > 0 ? "text-red-600" : "text-emerald-600"}
          />
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">AP Trend (12M)</p>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[20px] font-bold text-gray-900">{formatCurrency(vend.open_ap)}</p>
                <p className="text-[10px] text-gray-400">current period</p>
              </div>
              <div className="w-24 flex-shrink-0">
                <SparklineChart data={vend.ap_history} color="#F59E0B" height={36} />
              </div>
            </div>
          </div>
          <SummaryCard label="Active Vendors" value={`${vend.top_vendors.length}+`} sub="in AP aging" color="text-gray-900" />
        </div>

        {/* AP Aging */}
        <AgingTable buckets={vend.aging} total={vend.open_ap} label="AP" />

        {/* Top vendors table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Top Vendors by Balance</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Vendor</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Balance</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Due Date</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {vend.top_vendors.map((v, i) => {
                const ss = STATUS_STYLE[v.status] ?? STATUS_STYLE.current;
                return (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-[12px] font-medium text-gray-800">{v.name}</td>
                    <td className="px-4 py-3 text-right text-[12px] font-semibold text-gray-900">{formatCurrency(v.balance)}</td>
                    <td className="px-4 py-3 text-right text-[12px] text-gray-500">{v.due_date}</td>
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
