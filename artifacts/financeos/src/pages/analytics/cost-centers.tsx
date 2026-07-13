import { useState } from "react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { AnalyticsKpiCard } from "@/components/analytics/AnalyticsKpiCard";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle2, DollarSign, Layers, ChevronRight, ChevronDown, Plus } from "lucide-react";
import { useAnalyticsFilters } from "@/lib/analytics-context";
import { COST_CENTERS, fmtMoney } from "@/lib/analyticsDemoData";
import { ENTITY_CONFIG, type EntitySlug } from "@/lib/entities";
import type { CostCenter } from "@/lib/analyticsTypes";

const TYPE_STYLE: Record<string, string> = {
  "Operating": "bg-indigo-50 text-indigo-700",
  "Support": "bg-blue-50 text-blue-700",
  "Revenue Generating": "bg-emerald-50 text-emerald-700",
  "Shared Service": "bg-violet-50 text-violet-700",
  "Administrative": "bg-amber-50 text-amber-700",
};

function scopeLabel(scope: CostCenter["entityScope"]): string {
  if (scope === "all") return "All Entities";
  return ENTITY_CONFIG[scope as EntitySlug]?.name ?? scope;
}

export default function CostCentersPage() {
  const { entity } = useAnalyticsFilters();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(COST_CENTERS.filter((c) => c.parentId === null).map((c) => c.id)),
  );

  const inScope = (c: CostCenter) =>
    entity === "consolidated" || c.entityScope === "all" || c.entityScope === entity;

  const scoped = COST_CENTERS.filter(inScope);
  const totalCenters = scoped.length;
  const activeCenters = scoped.filter((c) => c.status === "Active").length;
  const totalDirect = scoped.reduce((s, c) => s + c.directCosts, 0);
  const totalAllocated = scoped.reduce((s, c) => s + c.allocatedCosts, 0);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const roots = scoped.filter((c) => c.parentId === null);

  type Row = { cc: CostCenter; depth: number };
  const rows: Row[] = [];
  const pushWithChildren = (cc: CostCenter, depth: number) => {
    rows.push({ cc, depth });
    if (expanded.has(cc.id)) {
      scoped.filter((c) => c.parentId === cc.id).forEach((child) => pushWithChildren(child, depth + 1));
    }
  };
  roots.forEach((r) => pushWithChildren(r, 0));

  const hasChildren = (id: string) => scoped.some((c) => c.parentId === id);

  return (
    <AnalyticsLayout
      title="Cost Centers"
      subtitle="Manage cost centers, hierarchy, owners and spend."
      actions={
        <Button
          className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-medium px-3 text-xs shadow-sm"
          data-testid="button-add-cost-center"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Cost Center
        </Button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsKpiCard title="Total Cost Centers" value={String(totalCenters)} icon={Building2} iconBg="#6366F1" vs="in current scope" />
        <AnalyticsKpiCard title="Active" value={String(activeCenters)} icon={CheckCircle2} iconBg="#10B981" vs={`of ${totalCenters}`} />
        <AnalyticsKpiCard title="Total Direct Costs" value={fmtMoney(totalDirect)} icon={DollarSign} iconBg="#F59E0B" vs="monthly" />
        <AnalyticsKpiCard title="Total Allocated" value={fmtMoney(totalAllocated)} icon={Layers} iconBg="#8b5cf6" vs="allocated in" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Cost Center Hierarchy</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-cost-centers">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Code</th>
                <th className="text-left px-4 py-2.5">Cost Center</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Owner</th>
                <th className="text-left px-4 py-2.5">Entity Scope</th>
                <th className="text-right px-4 py-2.5">Direct Costs</th>
                <th className="text-right px-4 py-2.5">Allocated</th>
                <th className="text-right px-4 py-2.5">Monthly Budget</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cc, depth }) => {
                const expandable = hasChildren(cc.id);
                return (
                  <tr key={cc.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cc.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <span className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 18}px` }}>
                        {expandable ? (
                          <button
                            onClick={() => toggle(cc.id)}
                            className="text-gray-400 hover:text-gray-700"
                            data-testid={`toggle-cc-${cc.id}`}
                          >
                            {expanded.has(cc.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        ) : (
                          <span className="w-4 h-4 inline-block" />
                        )}
                        {cc.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLE[cc.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {cc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cc.owner}</td>
                    <td className="px-4 py-3 text-gray-600">{scopeLabel(cc.entityScope)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(cc.directCosts)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(cc.allocatedCosts)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(cc.monthlyBudget)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        cc.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {cc.status}
                      </span>
                    </td>
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
