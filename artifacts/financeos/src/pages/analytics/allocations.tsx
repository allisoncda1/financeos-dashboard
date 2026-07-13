import { useState } from "react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { AnalyticsKpiCard } from "@/components/analytics/AnalyticsKpiCard";
import { useAnalyticsFilters } from "@/lib/analytics-context";
import {
  ALLOCATION_ENTRIES,
  getCostCenter,
  fmtMoney,
  fmtPct,
} from "@/lib/analyticsDemoData";
import { ENTITY_CONFIG } from "@/lib/entities";
import type { AllocationEntryStatus } from "@/lib/analyticsTypes";
import { ArrowRight, FileCheck, DollarSign, Clock, FileText } from "lucide-react";

const STATUS_STYLES: Record<AllocationEntryStatus, string> = {
  Draft: "bg-gray-100 text-gray-500",
  "Pending Review": "bg-amber-50 text-amber-600",
  Approved: "bg-indigo-50 text-indigo-600",
  Rejected: "bg-red-50 text-red-500",
  "Posted to Analytics": "bg-emerald-50 text-emerald-600",
  "Posted to Accounting": "bg-emerald-50 text-emerald-600",
};

type TabKey = "all" | "posted" | "approved" | "pending" | "draft";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "posted", label: "Posted" },
  { key: "approved", label: "Approved" },
  { key: "pending", label: "Pending" },
  { key: "draft", label: "Draft" },
];

function matchesTab(status: AllocationEntryStatus, tab: TabKey): boolean {
  switch (tab) {
    case "all": return true;
    case "posted": return status === "Posted to Analytics" || status === "Posted to Accounting";
    case "approved": return status === "Approved";
    case "pending": return status === "Pending Review";
    case "draft": return status === "Draft";
  }
}

export default function AllocationsPage() {
  const { scenario, entity } = useAnalyticsFilters();
  const [tab, setTab] = useState<TabKey>("all");

  const scenarioEntries = ALLOCATION_ENTRIES.filter(
    (e) =>
      e.scenario === scenario &&
      (entity === "consolidated" || e.sourceEntity === entity || e.destinationEntity === entity),
  );
  const rows = scenarioEntries.filter((e) => matchesTab(e.status, tab));

  const postedCount = scenarioEntries.filter(
    (e) => e.status === "Posted to Analytics" || e.status === "Posted to Accounting",
  ).length;
  const totalAllocated = scenarioEntries.reduce((s, e) => s + e.amount, 0);
  const pendingCount = scenarioEntries.filter((e) => e.status === "Pending Review").length;
  const draftCount = scenarioEntries.filter((e) => e.status === "Draft").length;

  return (
    <AnalyticsLayout
      title="Allocations"
      subtitle="Journal of every allocation produced by your rules."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsKpiCard title="Entries Posted" value={String(postedCount)} icon={FileCheck} iconBg="#10B981" vs="in this scenario" />
        <AnalyticsKpiCard title="Total Allocated" value={fmtMoney(totalAllocated)} icon={DollarSign} iconBg="#6366F1" vs="all entries" />
        <AnalyticsKpiCard title="Pending Review" value={String(pendingCount)} icon={Clock} iconBg="#F59E0B" vs="awaiting approval" />
        <AnalyticsKpiCard title="Drafts" value={String(draftCount)} icon={FileText} iconBg="#8B5CF6" vs="not submitted" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900">Allocation Journal</h3>
          <div className="flex items-center gap-1" data-testid="tabs-allocation-status">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                  tab === t.key ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-100"
                }`}
                data-testid={`tab-${t.key}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-allocations">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-left px-4 py-2.5">Source Transaction</th>
                <th className="text-left px-4 py-2.5">Source → Destination</th>
                <th className="text-left px-4 py-2.5">Cost Center</th>
                <th className="text-left px-4 py-2.5">Driver</th>
                <th className="text-right px-4 py-2.5">%</th>
                <th className="text-right px-4 py-2.5">Amount</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Approved By</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No allocation entries for this scenario / filter.
                  </td>
                </tr>
              )}
              {rows.map((e) => {
                const src = ENTITY_CONFIG[e.sourceEntity];
                const dst = ENTITY_CONFIG[e.destinationEntity];
                const cc = getCostCenter(e.destinationCostCenterId);
                return (
                  <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">{e.date}</td>
                    <td className="px-4 py-3 text-gray-700">{e.sourceTransaction}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-medium" style={{ color: src?.color }}>{src?.name ?? e.sourceEntity}</span>
                        <ArrowRight className="h-3 w-3 text-gray-300" />
                        <span className="font-medium" style={{ color: dst?.color }}>{dst?.name ?? e.destinationEntity}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cc?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{e.driver}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtPct(e.percentage, 0)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(e.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[e.status]}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.approvedBy ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AnalyticsLayout>
  );
}
