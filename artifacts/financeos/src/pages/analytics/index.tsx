import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { AnalyticsKpiCard } from "@/components/analytics/AnalyticsKpiCard";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Layers, PieChart as PieIcon, AlertTriangle, ListChecks,
} from "lucide-react";
import { useAnalyticsFilters } from "@/lib/analytics-context";
import {
  SHARED_EXPENSES,
  ALLOCATION_RULES,
  MONTHLY_ALLOCATION_TREND,
  sharedExpenseTotals,
  sharedCostByCategory,
  entityAdjustedRows,
  fmtMoney,
  fmtMoneyFull,
  fmtPct,
} from "@/lib/analyticsDemoData";
import { ENTITY_CONFIG, type EntitySlug } from "@/lib/entities";

const CAT_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b", "#a855f7"];

export default function AnalyticsOverviewPage() {
  const { entity } = useAnalyticsFilters();
  const totals = sharedExpenseTotals(entity);
  const activeRules = ALLOCATION_RULES.filter((r) => r.active).length;
  const byCategory = sharedCostByCategory(entity);

  const adjustedRows = entityAdjustedRows().filter(
    (r) => entity === "consolidated" || r.slug === entity,
  );

  const needsAttention = SHARED_EXPENSES.filter(
    (e) =>
      (e.status === "Unreviewed" || e.status === "Rule Suggested") &&
      (entity === "consolidated" || e.payingEntity === entity),
  ).sort((a, b) => b.amount - a.amount);

  return (
    <AnalyticsLayout
      title="Cost Accounting Overview"
      subtitle="Understand the true cost and profitability of every company, department, client and activity."
    >
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsKpiCard
          title="Total Shared Costs"
          value={fmtMoney(totals.total)}
          icon={Layers}
          iconBg="#6366F1"
          vs={`${totals.countTotal} shared expenses`}
        />
        <AnalyticsKpiCard
          title="Allocation Coverage"
          value={fmtPct(totals.coveragePct)}
          icon={PieIcon}
          iconBg="#10B981"
          change={totals.coveragePct >= 80 ? "+" + fmtPct(totals.coveragePct - 75) : ""}
          vs="of allocable costs"
        />
        <AnalyticsKpiCard
          title="Unallocated Costs"
          value={fmtMoney(totals.unallocated)}
          icon={AlertTriangle}
          iconBg="#F59E0B"
          vs={`${totals.countUnallocated} need review`}
        />
        <AnalyticsKpiCard
          title="Active Rules"
          value={String(activeRules)}
          icon={ListChecks}
          iconBg="#8b5cf6"
          vs={`${ALLOCATION_RULES.length} total rules`}
        />
      </div>

      {/* Trend + category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Allocation Trend</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Monthly direct, shared, allocated & unallocated costs</p>
          </div>
          <div className="p-4">
            <div className="h-[280px] w-full" data-testid="chart-allocation-trend">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MONTHLY_ALLOCATION_TREND} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    cursor={{ fill: "#f9fafb" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                    formatter={(value: number) => fmtMoneyFull(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="directCosts" name="Direct" stackId="a" fill="#E5E7EB" />
                  <Bar dataKey="sharedCosts" name="Shared" stackId="a" fill="#6366F1" />
                  <Bar dataKey="allocatedCosts" name="Allocated" stackId="a" fill="#10B981" />
                  <Bar dataKey="unallocatedCosts" name="Unallocated" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Shared Cost by Category</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Excludes excluded expenses</p>
          </div>
          <div className="p-4">
            <div className="h-[200px] w-full" data-testid="chart-shared-category">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={2}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                    formatter={(value: number) => fmtMoneyFull(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {byCategory.slice(0, 5).map((c, i) => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                    {c.category}
                  </span>
                  <span className="font-medium text-gray-900">{fmtMoney(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Entity profitability before/after allocation */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Entity Profitability — Before & After Allocation</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-entity-adjusted">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Entity</th>
                <th className="text-right px-4 py-2.5">Book Revenue</th>
                <th className="text-right px-4 py-2.5">Book Expenses</th>
                <th className="text-right px-4 py-2.5">Book NI</th>
                <th className="text-right px-4 py-2.5">Net Alloc Impact</th>
                <th className="text-right px-4 py-2.5">Adjusted NI</th>
                <th className="text-right px-4 py-2.5">Adj Margin</th>
              </tr>
            </thead>
            <tbody>
              {adjustedRows.map((r) => {
                const cfg = ENTITY_CONFIG[r.slug as EntitySlug];
                return (
                  <tr key={r.slug} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>{cfg?.name ?? r.slug}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(r.bookRevenue)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(r.bookExpenses)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${r.bookNetIncome >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtMoney(r.bookNetIncome)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${r.netAllocationImpact >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {r.netAllocationImpact >= 0 ? "+" : ""}{fmtMoney(r.netAllocationImpact)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.adjustedNetIncome >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtMoney(r.adjustedNetIncome)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtPct(r.adjustedMargin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Needs attention */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Needs Attention — Unallocated Expenses</h3>
          <span className="text-[11px] text-gray-400">{needsAttention.length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-needs-attention">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Vendor / Employee</th>
                <th className="text-left px-4 py-2.5">Description</th>
                <th className="text-right px-4 py-2.5">Amount</th>
                <th className="text-left px-4 py-2.5">Paying Entity</th>
                <th className="text-left px-4 py-2.5">Category</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {needsAttention.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">Nothing needs attention 🎉</td>
                </tr>
              )}
              {needsAttention.map((e) => {
                const cfg = ENTITY_CONFIG[e.payingEntity];
                return (
                  <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{e.vendorOrEmployee}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[280px] truncate">{e.description}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(e.amount)}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>{cfg?.name ?? e.payingEntity}</td>
                    <td className="px-4 py-3 text-gray-600">{e.costCategory}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        e.status === "Unreviewed" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
                      }`}>
                        {e.status}
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
