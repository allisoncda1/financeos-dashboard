import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { BVA_KPIS, BVA_TABLE, BVA_CHART } from "@/lib/budgetModuleMockData";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

const formatYAxis = (tickItem: number) => {
  if (tickItem === 0) return "0";
  return `$${(tickItem / 1000000).toFixed(1)}M`;
};

const formatCurrency = (val: number) => {
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absVal);
  return isNegative ? `(${formatted})` : formatted;
};

export default function BudgetVsActualPage() {
  return (
    <BudgetLayout title="Budget vs Actual" subtitle="Compare budgeted figures against actuals">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {BVA_KPIS.map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h4 className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 mb-2">{kpi.title}</h4>
            <div className="flex items-baseline justify-between">
              <p className="text-[22px] font-bold text-gray-900 leading-tight">{kpi.value}</p>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold">
              <span className={`flex items-center ${
                kpi.status === 'favorable' ? 'text-emerald-600' : 
                kpi.status === 'unfavorable' ? 'text-red-500' : 'text-gray-400'
              }`}>
                {kpi.status === 'favorable' && <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />}
                {kpi.status === 'unfavorable' && <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                {kpi.status === 'neutral' && <Minus className="w-3.5 h-3.5 mr-0.5" />}
                {kpi.variance}
              </span>
              <span className="text-gray-400 font-normal">vs budget</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4 sm:mb-6">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900">Monthly Performance</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Actual vs Budget trends for current FY</p>
          </div>
        </div>
        <div className="p-4">
          <div className="h-[280px] w-full" data-testid="chart-bva">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={BVA_CHART} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={formatYAxis} />
                <Tooltip
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                  formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', color: '#6b7280' }} iconType="circle" />
                <Bar dataKey="budget" name="Budget" fill="#e5e7eb" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Line type="monotone" dataKey="actual" name="Actual" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: "#10B981", strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-gray-900">Variance Analysis Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap" data-testid="table-bva-variance">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Category</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Actual YTD</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Budget YTD</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Variance $</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Variance %</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {BVA_TABLE.map((row) => (
                <tr key={row.category} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-[12px] text-gray-900">{row.category}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] text-gray-700">{formatCurrency(row.actual)}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] text-gray-700">{formatCurrency(row.budget)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium text-[12px] ${
                    row.variance > 0 ? (row.category.includes('Revenue') || row.category.includes('Profit') || row.category.includes('Income') ? 'text-emerald-600' : 'text-red-600') :
                    row.variance < 0 ? (row.category.includes('Revenue') || row.category.includes('Profit') || row.category.includes('Income') ? 'text-red-600' : 'text-emerald-600') : 'text-gray-500'
                  }`}>
                    {row.variance > 0 ? '+' : ''}{formatCurrency(row.variance)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px] text-gray-700">{row.variancePct > 0 ? '+' : ''}{row.variancePct}%</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      row.status === 'favorable' ? 'bg-emerald-50 text-emerald-700' : 
                      row.status === 'unfavorable' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BudgetLayout>
  );
}
