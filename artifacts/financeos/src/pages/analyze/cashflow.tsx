import { useMemo } from "react";
import { useDashboardData, useAllEntityBanking } from "@/hooks/useApi";
import { ENTITY_SLUGS, ENTITY_CONFIG } from "@/lib/entities";
import { useEntitySelection } from "@/lib/entity-context";
import { Droplets } from "lucide-react";
import { formatCurrency, DASH } from "@/lib/format";

export default function CashFlowPage() {
  const { selected } = useEntitySelection();
  const { data, source } = useDashboardData();
  const { data: allBanking } = useAllEntityBanking();

  const slugs = useMemo(() => ENTITY_SLUGS.filter(s => selected.includes(s)), [selected]);

  const totalCash = useMemo(() => (data ? slugs.reduce((s, slug) => s + data.metrics[slug].cash_on_hand, 0) : 0), [slugs, data]);
  const totalAR   = useMemo(() => (data ? slugs.reduce((s, slug) => s + data.metrics[slug].open_ar, 0) : 0), [slugs, data]);
  const totalAP   = useMemo(() => (data ? slugs.reduce((s, slug) => s + data.metrics[slug].open_ap, 0) : 0), [slugs, data]);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }

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
            <p className="text-[10px] sm:text-[11px] text-gray-400">Cash position across selected entities</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

        {/* KPI row — real cash-position figures only */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Cash on Hand", value: formatCurrency(totalCash), color: "#10B981", sub: `${slugs.length} ${slugs.length === 1 ? "entity" : "entities"} combined` },
            { label: "Portfolio AR",        value: formatCurrency(totalAR),   color: "#F59E0B", sub: "Pending collection" },
            { label: "Portfolio AP",        value: formatCurrency(totalAP),   color: "#EF4444", sub: "Outstanding payables" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{c.label}</p>
              <p className="text-[16px] sm:text-[20px] font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Cash flow statement — honest empty state (Core does not publish one) */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center">
          <p className="text-[13px] font-semibold text-gray-900">Cash flow statement is not available yet from FinanceOS Core.</p>
          <p className="text-[12px] text-gray-500 mt-1 max-w-md mx-auto">
            The cash position below is drawn from live Core figures. A full statement of cash flows (operating / investing / financing activities) is not yet published.
          </p>
        </div>

        {/* Per-entity cash position — real figures */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Cash Position by Entity</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <tr>
                  {["Entity", "Cash on Hand", "Open AR", "Open AP", "Bank Accounts"].map(h => (
                    <th key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5 text-right first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slugs.map(slug => {
                  const m = data.metrics[slug];
                  const cfg = ENTITY_CONFIG[slug];
                  const bk = allBanking?.[slug];
                  return (
                    <tr key={slug} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                          <span className="text-[12px] font-medium text-gray-800">{cfg.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-emerald-700">{formatCurrency(m.cash_on_hand)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-amber-700">{formatCurrency(m.open_ar)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-red-700">{formatCurrency(m.open_ap)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-gray-600">{bk ? `${bk.accounts.length} accounts` : DASH}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-4 py-2.5 text-[12px] font-bold text-gray-900">Portfolio Total</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-emerald-700">{formatCurrency(totalCash)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-amber-700">{formatCurrency(totalAR)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-red-700">{formatCurrency(totalAP)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold text-gray-700">
                    {allBanking ? `${slugs.reduce((s, slug) => s + allBanking[slug].accounts.length, 0)} accounts` : DASH}
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
