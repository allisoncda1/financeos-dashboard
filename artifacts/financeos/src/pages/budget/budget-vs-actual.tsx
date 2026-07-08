import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {BVA_KPIS.map((kpi, idx) => (
          <Card key={idx} className="shadow-sm border-slate-200">
            <CardContent className="p-5">
              <h4 className="text-sm font-medium text-slate-500 mb-2">{kpi.title}</h4>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{kpi.value}</p>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
                <span className={`flex items-center ${
                  kpi.status === 'favorable' ? 'text-emerald-600' : 
                  kpi.status === 'unfavorable' ? 'text-rose-600' : 'text-slate-500'
                }`}>
                  {kpi.status === 'favorable' && <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />}
                  {kpi.status === 'unfavorable' && <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                  {kpi.status === 'neutral' && <Minus className="w-3.5 h-3.5 mr-0.5" />}
                  {kpi.variance}
                </span>
                <span className="text-slate-400">vs budget</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm border-slate-200 mb-6">
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-900">Monthly Performance</h3>
            <p className="text-sm text-slate-500">Actual vs Budget trends for current FY</p>
          </div>
          <div className="h-[300px] w-full" data-testid="chart-bva">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={BVA_CHART} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={formatYAxis} />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconType="circle" />
                <Bar dataKey="budget" name="Budget" fill="#CBD5E1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line type="monotone" dataKey="actual" name="Actual" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: "#10B981", strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Variance Analysis Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap" data-testid="table-bva-variance">
              <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-right">Actual YTD</th>
                  <th className="px-4 py-3 font-medium text-right">Budget YTD</th>
                  <th className="px-4 py-3 font-medium text-right">Variance $</th>
                  <th className="px-4 py-3 font-medium text-right">Variance %</th>
                  <th className="px-6 py-3 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {BVA_TABLE.map((row) => (
                  <tr key={row.category} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{row.category}</td>
                    <td className="px-4 py-4 text-right text-slate-600">{formatCurrency(row.actual)}</td>
                    <td className="px-4 py-4 text-right text-slate-600">{formatCurrency(row.budget)}</td>
                    <td className={`px-4 py-4 text-right font-medium ${
                      row.variance > 0 ? (row.category.includes('Revenue') || row.category.includes('Profit') || row.category.includes('Income') ? 'text-emerald-600' : 'text-rose-600') :
                      row.variance < 0 ? (row.category.includes('Revenue') || row.category.includes('Profit') || row.category.includes('Income') ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-500'
                    }`}>
                      {row.variance > 0 ? '+' : ''}{formatCurrency(row.variance)}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600">{row.variancePct > 0 ? '+' : ''}{row.variancePct}%</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.status === 'favorable' ? 'bg-emerald-100 text-emerald-800' : 
                        row.status === 'unfavorable' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </BudgetLayout>
  );
}
