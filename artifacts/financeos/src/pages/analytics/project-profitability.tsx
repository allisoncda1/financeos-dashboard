import { DollarSign, Percent, Layers, FlaskConical } from "lucide-react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { AnalyticsKpiCard } from "@/components/analytics/AnalyticsKpiCard";
import { useAnalyticsFilters } from "@/lib/analytics-context";
import { ENTITY_CONFIG } from "@/lib/entities";
import {
  PROJECTS,
  CLIENTS,
  projectTotals,
  projectStatus,
  fmtMoneyFull,
  fmtPct,
} from "@/lib/analyticsDemoData";
import type { ProfitabilityStatus, ProjectKind } from "@/lib/analyticsTypes";

const STATUS_STYLES: Record<ProfitabilityStatus, string> = {
  "Highly Profitable": "bg-emerald-50 text-emerald-700",
  Profitable: "bg-emerald-50 text-emerald-700",
  "Low Margin": "bg-amber-50 text-amber-700",
  "Break Even": "bg-gray-100 text-gray-600",
  Unprofitable: "bg-red-50 text-red-700",
  "Missing Data": "bg-gray-100 text-gray-500",
};

const KIND_STYLES: Record<ProjectKind, string> = {
  Project: "bg-indigo-50 text-indigo-700",
  Service: "bg-blue-50 text-blue-700",
  Product: "bg-purple-50 text-purple-700",
  Campaign: "bg-amber-50 text-amber-700",
  Contract: "bg-teal-50 text-teal-700",
  "Client Engagement": "bg-emerald-50 text-emerald-700",
};

function clientName(clientId: string | null): string {
  if (!clientId) return "Internal";
  return CLIENTS.find((c) => c.id === clientId)?.name ?? "—";
}

export default function ProjectProfitabilityPage() {
  const { entity } = useAnalyticsFilters();

  const scoped = PROJECTS.filter((p) => entity === "consolidated" || p.entity === entity);
  const revenueProjects = scoped
    .filter((p) => p.revenue > 0)
    .map((p) => ({ project: p, totals: projectTotals(p), status: projectStatus(p) }))
    .sort((a, b) => b.totals.profit - a.totals.profit);
  const internalProjects = scoped
    .filter((p) => p.revenue === 0)
    .map((p) => ({ project: p, totals: projectTotals(p) }))
    .sort((a, b) => b.totals.totalCost - a.totals.totalCost);

  const totalRevenue = revenueProjects.reduce((s, r) => s + r.project.revenue, 0);
  const totalProfit = revenueProjects.reduce((s, r) => s + r.totals.profit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const internalInvested = internalProjects.reduce((s, r) => s + r.totals.totalCost, 0);

  return (
    <AnalyticsLayout
      title="Project Profitability"
      subtitle="Profitability by project, service, campaign and contract — including internal investments."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsKpiCard
          title="Project Revenue"
          value={fmtMoneyFull(totalRevenue)}
          icon={DollarSign}
          iconBg="#6366F1"
          vs={`${revenueProjects.length} revenue projects`}
        />
        <AnalyticsKpiCard
          title="Project Profit"
          value={fmtMoneyFull(totalProfit)}
          icon={Layers}
          iconBg="#10B981"
          vs="after overhead"
        />
        <AnalyticsKpiCard
          title="Avg Margin"
          value={fmtPct(avgMargin)}
          icon={Percent}
          iconBg="#F59E0B"
          vs="revenue projects"
        />
        <AnalyticsKpiCard
          title="Internal Invested"
          value={fmtMoneyFull(internalInvested)}
          icon={FlaskConical}
          iconBg="#8B5CF6"
          vs={`${internalProjects.length} internal projects`}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Revenue-Generating Projects</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-project-profitability">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Project</th>
                <th className="text-left px-4 py-2.5">Kind</th>
                <th className="text-left px-4 py-2.5">Client</th>
                <th className="text-left px-4 py-2.5">Entity</th>
                <th className="text-right px-4 py-2.5">Revenue</th>
                <th className="text-right px-4 py-2.5">Labor</th>
                <th className="text-right px-4 py-2.5">Vendor</th>
                <th className="text-right px-4 py-2.5">Software</th>
                <th className="text-right px-4 py-2.5">Allocated OH</th>
                <th className="text-right px-4 py-2.5">Total Cost</th>
                <th className="text-right px-4 py-2.5">Profit</th>
                <th className="text-right px-4 py-2.5">Margin</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {revenueProjects.map(({ project: p, totals, status }) => {
                const cfg = ENTITY_CONFIG[p.entity];
                return (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                    data-testid={`row-project-${p.id}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${KIND_STYLES[p.kind]}`}>
                        {p.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{clientName(p.clientId)}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>
                      {cfg?.name ?? p.entity}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(p.revenue)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(p.laborCost)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(p.vendorCost)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(p.softwareCost)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(p.allocatedOverhead)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(totals.totalCost)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {fmtMoneyFull(totals.profit)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${(totals.margin ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {fmtPct(totals.margin)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {revenueProjects.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No revenue projects for this entity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Internal Investments</h3>
          <span className="text-[11px] text-gray-400">Projects without external revenue</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-internal-projects">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Project</th>
                <th className="text-left px-4 py-2.5">Kind</th>
                <th className="text-left px-4 py-2.5">Entity</th>
                <th className="text-right px-4 py-2.5">Labor</th>
                <th className="text-right px-4 py-2.5">Vendor</th>
                <th className="text-right px-4 py-2.5">Software</th>
                <th className="text-right px-4 py-2.5">Allocated OH</th>
                <th className="text-right px-4 py-2.5">Total Cost Invested</th>
              </tr>
            </thead>
            <tbody>
              {internalProjects.map(({ project: p, totals }) => {
                const cfg = ENTITY_CONFIG[p.entity];
                return (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                    data-testid={`row-internal-${p.id}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${KIND_STYLES[p.kind]}`}>
                        {p.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>
                      {cfg?.name ?? p.entity}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(p.laborCost)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(p.vendorCost)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(p.softwareCost)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(p.allocatedOverhead)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtMoneyFull(totals.totalCost)}</td>
                  </tr>
                );
              })}
              {internalProjects.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No internal projects for this entity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AnalyticsLayout>
  );
}
