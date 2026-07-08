import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {DEPARTMENTS_DATA.map((dept) => {
          const Icon = iconMap[dept.name as keyof typeof iconMap] || Users;
          return (
            <Card key={dept.name} className="shadow-sm border-slate-200 hover:border-emerald-200 transition-colors cursor-pointer group" data-testid={`card-dept-${dept.name}`}>
              <CardContent className="p-5">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                  <Icon className="w-5 h-5 text-emerald-600" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900">{dept.name}</h4>
                <p className="text-xs text-slate-500 mb-3">{dept.owner}</p>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xl font-bold text-slate-900 tracking-tight">{formatCurrency(dept.budget)}</span>
                </div>
                <div className="text-xs font-medium">
                  <span className={`${dept.status === 'favorable' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {dept.status === 'favorable' ? 'Under budget' : 'Over budget'}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="shadow-sm border-slate-200 h-full">
            <CardContent className="p-6">
              <div className="mb-6">
                <h3 className="text-base font-semibold text-slate-900">Budget Allocation</h3>
                <p className="text-sm text-slate-500">Distribution by department</p>
              </div>
              <div className="h-[300px] w-full" data-testid="chart-dept-allocation">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={DEPARTMENTS_DATA} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={formatYAxis} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#1E293B', fontWeight: 500 }} width={120} />
                    <Tooltip
                      cursor={{ fill: '#F1F5F9' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="budget" fill="#10B981" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="shadow-sm border-slate-200 h-full">
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">Department Overview</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap" data-testid="table-departments">
                  <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Owner</th>
                      <th className="px-4 py-3 font-medium text-right">Budget</th>
                      <th className="px-4 py-3 font-medium text-right">Actual YTD</th>
                      <th className="px-4 py-3 font-medium text-right">Variance</th>
                      <th className="px-6 py-3 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {DEPARTMENTS_DATA.map((row) => (
                      <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                        <td className="px-4 py-4 text-slate-600">{row.owner}</td>
                        <td className="px-4 py-4 text-right text-slate-600">{formatCurrency(row.budget)}</td>
                        <td className="px-4 py-4 text-right text-slate-600">{formatCurrency(row.actual)}</td>
                        <td className={`px-4 py-4 text-right font-medium ${row.status === 'favorable' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {row.variance > 0 ? '+' : ''}{formatCurrency(row.variance)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.status === 'favorable' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
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
        </div>
      </div>
    </BudgetLayout>
  );
}
