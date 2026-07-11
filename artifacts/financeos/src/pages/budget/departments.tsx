import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { DEPARTMENTS_DATA } from "@/lib/budgetModuleMockData";
import { Users, Briefcase, Code, Settings } from "lucide-react";

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

const iconMap = {
  "Sales & Marketing": Users,
  "G&A": Briefcase,
  "Product / Tech": Code,
  "Operations": Settings,
};

export default function BudgetDepartmentsPage() {
  return (
    <BudgetLayout title="Department Budgets" subtitle="Manage budgets by department">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {DEPARTMENTS_DATA.map((dept) => {
          const Icon = iconMap[dept.name as keyof typeof iconMap] || Users;
          return (
            <div key={dept.name} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-emerald-200 transition-colors cursor-pointer group" data-testid={`card-dept-${dept.name}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                  <Icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h4 className="text-[13px] font-semibold text-gray-900 truncate">{dept.name}</h4>
                  <p className="text-[11px] text-gray-500 truncate">{dept.owner}</p>
                </div>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[22px] font-bold text-gray-900 leading-tight">{formatCurrency(dept.budget)}</span>
              </div>
              <div className="text-[11px] font-semibold">
                <span className={`${dept.status === 'favorable' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {dept.status === 'favorable' ? 'Under budget' : 'Over budget'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-gray-900">Budget Allocation</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Distribution by department</p>
              </div>
            </div>
            <div className="p-4">
              <div className="h-[280px] w-full" data-testid="chart-dept-allocation">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={DEPARTMENTS_DATA} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={formatYAxis} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563', fontWeight: 500 }} width={110} />
                    <Tooltip
                      cursor={{ fill: '#f9fafb' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="budget" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900">Department Overview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap" data-testid="table-departments">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Department</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Owner</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Budget</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Actual YTD</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Variance</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {DEPARTMENTS_DATA.map((row) => (
                    <tr key={row.name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[12px] text-gray-900">{row.name}</td>
                      <td className="px-4 py-2.5 text-[12px] text-gray-700">{row.owner}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-gray-700">{formatCurrency(row.budget)}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-gray-700">{formatCurrency(row.actual)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium text-[12px] ${row.status === 'favorable' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {row.variance > 0 ? '+' : ''}{formatCurrency(row.variance)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          row.status === 'favorable' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
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
        </div>
      </div>
    </BudgetLayout>
  );
}
