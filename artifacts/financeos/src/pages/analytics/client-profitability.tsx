import { useState } from "react";
import { Fragment } from "react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { ChevronDown, ChevronRight, DollarSign, Percent, TrendingUp, TrendingDown } from "lucide-react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { AnalyticsKpiCard } from "@/components/analytics/AnalyticsKpiCard";
import { useAnalyticsFilters } from "@/lib/analytics-context";
import { ENTITY_CONFIG } from "@/lib/entities";
import {
  CLIENTS,
  clientTotals,
  clientStatus,
  fmtMoneyFull,
  fmtPct,
} from "@/lib/analyticsDemoData";
import type { ProfitabilityStatus } from "@/lib/analyticsTypes";

const STATUS_STYLES: Record<ProfitabilityStatus, string> = {
  "Highly Profitable": "bg-emerald-50 text-emerald-700",
  Profitable: "bg-emerald-50 text-emerald-700",
  "Low Margin": "bg-amber-50 text-amber-700",
  "Break Even": "bg-gray-100 text-gray-600",
  Unprofitable: "bg-red-50 text-red-700",
  "Missing Data": "bg-gray-100 text-gray-500",
};

function StatusPill({ status }: { status: ProfitabilityStatus }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={positive ? "#10B981" : "#EF4444"}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ClientProfitabilityPage() {
  const { entity } = useAnalyticsFilters();
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = CLIENTS.filter((c) => entity === "consolidated" || c.entity === entity)
    .map((c) => ({ client: c, totals: clientTotals(c), status: clientStatus(c) }))
    .sort((a, b) => b.totals.profit - a.totals.profit);

  const totalRevenue = rows.reduce((s, r) => s + r.client.revenue, 0);
  const revenueRows = rows.filter((r) => r.client.revenue > 0);
  const avgMargin =
    revenueRows.length > 0
      ? revenueRows.reduce((s, r) => s + (r.totals.margin ?? 0), 0) / revenueRows.length
      : 0;
  const profitableCount = rows.filter(
    (r) => r.status === "Highly Profitable" || r.status === "Profitable",
  ).length;
  const unprofitableCount = rows.filter((r) => r.status === "Unprofitable").length;

  return (
    <AnalyticsLayout
      title="Client Profitability"
      subtitle="True cost to serve and margin for every client, after overhead allocation."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsKpiCard
          title="Total Client Revenue"
          value={fmtMoneyFull(totalRevenue)}
          icon={DollarSign}
          iconBg="#6366F1"
          vs="across active clients"
        />
        <AnalyticsKpiCard
          title="Avg Margin"
          value={fmtPct(avgMargin)}
          icon={Percent}
          iconBg="#10B981"
          vs="revenue-generating clients"
        />
        <AnalyticsKpiCard
          title="Profitable Clients"
          value={String(profitableCount)}
          icon={TrendingUp}
          iconBg="#10B981"
          vs={`of ${rows.length} clients`}
        />
        <AnalyticsKpiCard
          title="Unprofitable Clients"
          value={String(unprofitableCount)}
          icon={TrendingDown}
          iconBg="#EF4444"
          vs="need attention"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Client Profitability Detail</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-client-profitability">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 w-8"></th>
                <th className="text-left px-4 py-2.5">Client</th>
                <th className="text-left px-4 py-2.5">Entity</th>
                <th className="text-right px-4 py-2.5">Revenue</th>
                <th className="text-right px-4 py-2.5">Direct Costs</th>
                <th className="text-right px-4 py-2.5">Allocated Overhead</th>
                <th className="text-right px-4 py-2.5">Total Cost</th>
                <th className="text-right px-4 py-2.5">Profit</th>
                <th className="text-right px-4 py-2.5">Margin</th>
                <th className="text-center px-4 py-2.5">Trend</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ client: c, totals, status }) => {
                const cfg = ENTITY_CONFIG[c.entity];
                const isOpen = expanded === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                      data-testid={`row-client-${c.id}`}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>
                        {cfg?.name ?? c.entity}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(c.revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(totals.directCosts)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(c.allocatedOverhead)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(totals.totalCost)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {fmtMoneyFull(totals.profit)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${(totals.margin ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {fmtPct(totals.margin)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Sparkline data={c.trend} positive={totals.profit >= 0} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={status} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <td></td>
                        <td colSpan={10} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                Cost Breakdown
                              </p>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                                <div className="flex justify-between"><span className="text-gray-500">Direct Labor</span><span className="text-gray-800 font-medium">{fmtMoneyFull(c.directLabor)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Contractors</span><span className="text-gray-800 font-medium">{fmtMoneyFull(c.contractors)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Software</span><span className="text-gray-800 font-medium">{fmtMoneyFull(c.softwareCosts)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Call Costs</span><span className="text-gray-800 font-medium">{fmtMoneyFull(c.callCosts)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Media</span><span className="text-gray-800 font-medium">{fmtMoneyFull(c.mediaCosts)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Allocated Overhead</span><span className="text-gray-800 font-medium">{fmtMoneyFull(c.allocatedOverhead)}</span></div>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                Delivery
                              </p>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                                <div className="flex justify-between"><span className="text-gray-500">Employees Assigned</span><span className="text-gray-800 font-medium">{c.employeesAssigned}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Call Volume</span><span className="text-gray-800 font-medium">{c.callVolume.toLocaleString("en-US")}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Projects</span><span className="text-gray-800 font-medium">{c.projects.length}</span></div>
                              </div>
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
