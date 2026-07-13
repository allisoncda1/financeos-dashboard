import { Fragment, useState } from "react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { AnalyticsKpiCard } from "@/components/analytics/AnalyticsKpiCard";
import { Switch } from "@/components/ui/switch";
import { useAnalyticsFilters } from "@/lib/analytics-context";
import {
  ALLOCATION_RULES,
  getCostCenter,
  sharedExpenseTotals,
  fmtMoney,
  fmtPct,
} from "@/lib/analyticsDemoData";
import { ENTITY_CONFIG } from "@/lib/entities";
import type { RuleApprovalStatus } from "@/lib/analyticsTypes";
import { ChevronDown, ChevronRight, Layers, Clock, DollarSign, PieChart } from "lucide-react";

const APPROVAL_STYLES: Record<RuleApprovalStatus, string> = {
  Approved: "bg-emerald-50 text-emerald-600",
  "Pending Approval": "bg-amber-50 text-amber-600",
  Draft: "bg-gray-100 text-gray-500",
  Rejected: "bg-red-50 text-red-500",
};

export default function AllocationRulesPage() {
  const { entity } = useAnalyticsFilters();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>(
    Object.fromEntries(ALLOCATION_RULES.map((r) => [r.id, r.active])),
  );

  const rules = ALLOCATION_RULES.filter(
    (r) =>
      entity === "consolidated" ||
      r.sourceEntity === entity ||
      r.destinations.some((d) => d.entity === entity),
  );

  const activeCount = rules.filter((r) => activeMap[r.id]).length;
  const pendingCount = rules.filter((r) => r.approvalStatus === "Pending Approval").length;
  const monthlyImpact = rules.filter((r) => activeMap[r.id]).reduce(
    (s, r) => s + r.monthlyImpactEstimate,
    0,
  );
  const coverage = sharedExpenseTotals(entity).coveragePct;

  return (
    <AnalyticsLayout
      title="Allocation Rules"
      subtitle="Define how shared costs are distributed across the portfolio."
      showScenario={false}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsKpiCard title="Active Rules" value={String(activeCount)} icon={Layers} iconBg="#6366F1" vs={`${rules.length} total`} />
        <AnalyticsKpiCard title="Pending Approval" value={String(pendingCount)} icon={Clock} iconBg="#F59E0B" vs="awaiting sign-off" />
        <AnalyticsKpiCard title="Est. Monthly Impact" value={fmtMoney(monthlyImpact)} icon={DollarSign} iconBg="#10B981" vs="active rules" />
        <AnalyticsKpiCard title="Allocation Coverage" value={fmtPct(coverage)} icon={PieChart} iconBg="#8B5CF6" vs="of shared costs" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Rules</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-allocation-rules">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 w-8"></th>
                <th className="text-left px-4 py-2.5">Rule</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Source Entity</th>
                <th className="text-left px-4 py-2.5">Vendor / Employee</th>
                <th className="text-left px-4 py-2.5">Method</th>
                <th className="text-left px-4 py-2.5">Destinations</th>
                <th className="text-right px-4 py-2.5">Priority</th>
                <th className="text-left px-4 py-2.5">Effective</th>
                <th className="text-left px-4 py-2.5">Approval</th>
                <th className="text-center px-4 py-2.5">Active</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const isOpen = expanded === rule.id;
                const cfg = ENTITY_CONFIG[rule.sourceEntity];
                const destTotal = rule.destinations.reduce((s, d) => s + d.percentage, 0);
                return (
                  <Fragment key={rule.id}>
                    <tr
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : rule.id)}
                      data-testid={`row-rule-${rule.id}`}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{rule.name}</td>
                      <td className="px-4 py-3 text-gray-600">{rule.ruleType}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>{cfg?.name ?? rule.sourceEntity}</td>
                      <td className="px-4 py-3 text-gray-600">{rule.vendorOrEmployee}</td>
                      <td className="px-4 py-3 text-gray-600">{rule.method}</td>
                      <td className="px-4 py-3 text-gray-600">{rule.destinations.length} entities</td>
                      <td className="px-4 py-3 text-right text-gray-700">{rule.priority}</td>
                      <td className="px-4 py-3 text-gray-600">{rule.effectiveDate}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${APPROVAL_STYLES[rule.approvalStatus]}`}>
                          {rule.approvalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={activeMap[rule.id]}
                          onCheckedChange={(v) => setActiveMap((m) => ({ ...m, [rule.id]: v }))}
                          data-testid={`switch-rule-${rule.id}`}
                        />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <td colSpan={11} className="px-4 py-4">
                          <div className="max-w-2xl">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Destination Breakdown</p>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                  <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                    <th className="text-left px-4 py-2.5">Entity</th>
                                    <th className="text-left px-4 py-2.5">Cost Center</th>
                                    <th className="text-right px-4 py-2.5">Percentage</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rule.destinations.map((d, i) => {
                                    const dcfg = ENTITY_CONFIG[d.entity];
                                    const cc = getCostCenter(d.costCenterId);
                                    return (
                                      <tr key={i} className="border-b border-gray-100 last:border-0">
                                        <td className="px-4 py-3 font-medium" style={{ color: dcfg?.color }}>{dcfg?.name ?? d.entity}</td>
                                        <td className="px-4 py-3 text-gray-600">{cc?.name ?? "—"}</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtPct(d.percentage, 0)}</td>
                                      </tr>
                                    );
                                  })}
                                  <tr className="bg-gray-50 font-semibold">
                                    <td className="px-4 py-2.5 text-gray-700" colSpan={2}>Total</td>
                                    <td className={`px-4 py-2.5 text-right ${destTotal === 100 ? "text-emerald-600" : "text-red-500"}`}>
                                      {fmtPct(destTotal, 0)}
                                      {destTotal !== 100 && <span className="ml-1 text-[10px] font-normal">(must equal 100%)</span>}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AnalyticsLayout>
  );
}
