import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { AnalyticsKpiCard } from "@/components/analytics/AnalyticsKpiCard";
import { useAnalyticsFilters } from "@/lib/analytics-context";
import { entityAdjustedRows, fmtMoney, fmtMoneyFull, fmtPct } from "@/lib/analyticsDemoData";
import { ENTITY_CONFIG } from "@/lib/entities";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { Scale, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

const yTick = (n: number) => (n === 0 ? "0" : `$${(n / 1000).toFixed(0)}K`);

export default function EntityProfitabilityPage() {
  const { entity } = useAnalyticsFilters();
  const allRows = entityAdjustedRows();
  const rows = entity === "consolidated" ? allRows : allRows.filter((r) => r.slug === entity);

  const portfolioBookNI = rows.reduce((s, r) => s + r.bookNetIncome, 0);
  const portfolioAdjustedNI = rows.reduce((s, r) => s + r.adjustedNetIncome, 0);
  const totalAllocatedOut = rows.reduce((s, r) => s + r.allocatedOut, 0);
  const totalAllocatedIn = rows.reduce((s, r) => s + r.allocatedIn, 0);

  const chartData = rows.map((r) => ({
    name: ENTITY_CONFIG[r.slug]?.name ?? r.slug,
    color: ENTITY_CONFIG[r.slug]?.color ?? "#6366F1",
    book: r.bookNetIncome,
    adjusted: r.adjustedNetIncome,
  }));

  return (
    <AnalyticsLayout
      title="Entity Profitability"
      subtitle="Book vs. economic profitability for each legal entity."
      showScenario={false}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsKpiCard title="Portfolio Book NI" value={fmtMoney(portfolioBookNI)} icon={Scale} iconBg="#6366F1" vs="as recorded" />
        <AnalyticsKpiCard title="Portfolio Adjusted NI" value={fmtMoney(portfolioAdjustedNI)} icon={TrendingUp} iconBg="#10B981" vs="after allocation" />
        <AnalyticsKpiCard title="Total Allocated Out" value={fmtMoney(totalAllocatedOut)} icon={ArrowUpRight} iconBg="#F59E0B" vs="reallocated away" />
        <AnalyticsKpiCard title="Total Allocated In" value={fmtMoney(totalAllocatedIn)} icon={ArrowDownRight} iconBg="#8B5CF6" vs="reallocated to" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Book vs. Adjusted Net Income</h3>
        </div>
        <div className="p-4" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={yTick} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => fmtMoneyFull(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="book" name="Book NI" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="adjusted" name="Adjusted NI" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Profitability Before &amp; After Allocation</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-entity-profitability">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Entity</th>
                <th className="text-right px-4 py-2.5">Book Revenue</th>
                <th className="text-right px-4 py-2.5">Book Expenses</th>
                <th className="text-right px-4 py-2.5">Book NI</th>
                <th className="text-right px-4 py-2.5">Allocated Out</th>
                <th className="text-right px-4 py-2.5">Allocated In</th>
                <th className="text-right px-4 py-2.5">Net Impact</th>
                <th className="text-right px-4 py-2.5">Adjusted NI</th>
                <th className="text-right px-4 py-2.5">Adjusted Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cfg = ENTITY_CONFIG[r.slug];
                return (
                  <tr key={r.slug} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>{cfg?.name ?? r.slug}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(r.bookRevenue)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(r.bookExpenses)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${r.bookNetIncome >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtMoneyFull(r.bookNetIncome)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtMoneyFull(r.allocatedOut)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtMoneyFull(r.allocatedIn)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${r.netAllocationImpact >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtMoneyFull(r.netAllocationImpact)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.adjustedNetIncome >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtMoneyFull(r.adjustedNetIncome)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtPct(r.adjustedMargin)}</td>
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
