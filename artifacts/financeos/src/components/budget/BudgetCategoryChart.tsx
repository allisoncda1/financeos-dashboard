import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { BUDGET_CATEGORIES } from "@/lib/budgetMockData";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BudgetCategoryChart() {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  // Donut shows the allocation of total budgeted revenue (COGS + opex + other expenses + net income = $17.4M)
  const donutData = BUDGET_CATEGORIES.filter((c) => c.inDonut);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-900">Budget by Category (P&L)</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 flex flex-col items-center justify-center flex-1">
        <div className="relative h-[180px] w-full mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {donutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Total Budget</span>
            <span className="text-xl font-bold text-gray-900">$17.4M</span>
          </div>
        </div>

        <div className="w-full space-y-2.5">
          {BUDGET_CATEGORIES.map((category) => (
            <div key={category.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
                <span
                  className={`text-[12px] ${
                    category.name === "Net Income" || category.name === "Gross Profit"
                      ? "text-gray-900 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  {category.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-medium text-gray-900">{formatCurrency(category.value)}</span>
                <span className="text-[11px] text-gray-400 w-10 text-right">{category.percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
